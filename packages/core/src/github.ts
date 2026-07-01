/**
 * ブラウザから GitHub REST API (api.github.com) を直接叩く薄いクライアント。
 * - 読み取り: Git Data API（trees/blobs）。Contents APIの1MB制限を受けない（blobは100MBまで）。
 * - 書き込み: blob作成 → tree作成 → commit作成 → ref更新。複数ファイルの変更を1コミットで
 *   原子的に反映でき、ref更新の fast-forward 失敗を競合検知に使う。
 */

const API_BASE = "https://api.github.com";

export class GitHubApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export interface RepoRef {
  owner: string;
  name: string;
}

export interface RepoInfo {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  description: string | null;
  pushedAt: string | null;
  permissions?: { push?: boolean };
}

export interface TreeEntry {
  path: string;
  mode: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
}

export interface CommitChange {
  path: string;
  /** UTF-8テキスト内容。delete/contentBase64と排他。 */
  content?: string;
  /** バイナリ内容（base64）。 */
  contentBase64?: string;
  /** trueならファイル削除。 */
  delete?: boolean;
}

export interface CommitResult {
  commitSha: string;
  treeSha: string;
  /** path → 新しいblob sha（削除エントリは含まない） */
  blobShas: Map<string, string>;
}

function toRepoInfo(r: any): RepoInfo {
  return {
    owner: r.owner.login,
    name: r.name,
    fullName: r.full_name,
    defaultBranch: r.default_branch,
    private: r.private,
    description: r.description ?? null,
    pushedAt: r.pushed_at ?? null,
    permissions: r.permissions,
  };
}

export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function base64ToUtf8(b64: string): string {
  const bytes = base64ToBytes(b64);
  return new TextDecoder("utf-8").decode(bytes);
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s/g, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export class GitHubClient {
  constructor(private token: string) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    init?: RequestInit
  ): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      ...init,
    });
    if (!res.ok) {
      let message = `GitHub API ${res.status}`;
      try {
        const data = await res.json();
        if (data?.message) message = `${data.message} (${res.status})`;
      } catch {
        // ignore
      }
      throw new GitHubApiError(res.status, message);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async getUser(): Promise<{ login: string; name: string | null; avatarUrl: string }> {
    const u = await this.request<any>("GET", "/user");
    return { login: u.login, name: u.name, avatarUrl: u.avatar_url };
  }

  /** PATでアクセスできるリポジトリ一覧（push日時降順）。 */
  async listRepos(page = 1, perPage = 50): Promise<RepoInfo[]> {
    const repos = await this.request<any[]>(
      "GET",
      `/user/repos?sort=pushed&per_page=${perPage}&page=${page}`
    );
    return repos.map(toRepoInfo);
  }

  async getRepo(owner: string, name: string): Promise<RepoInfo> {
    return toRepoInfo(await this.request<any>("GET", `/repos/${owner}/${name}`));
  }

  /** ブランチ先端のコミットSHA。 */
  async getRefSha(repo: RepoRef, branch: string): Promise<string> {
    const r = await this.request<any>(
      "GET",
      `/repos/${repo.owner}/${repo.name}/git/ref/${encodeURIComponent(`heads/${branch}`)}`
    );
    return r.object.sha;
  }

  async getCommit(repo: RepoRef, sha: string): Promise<{ sha: string; treeSha: string }> {
    const c = await this.request<any>("GET", `/repos/${repo.owner}/${repo.name}/git/commits/${sha}`);
    return { sha: c.sha, treeSha: c.tree.sha };
  }

  async getTreeRecursive(repo: RepoRef, treeSha: string): Promise<{ entries: TreeEntry[]; truncated: boolean }> {
    const t = await this.request<any>(
      "GET",
      `/repos/${repo.owner}/${repo.name}/git/trees/${treeSha}?recursive=1`
    );
    return {
      entries: (t.tree as any[]).map((e) => ({
        path: e.path,
        mode: e.mode,
        type: e.type,
        sha: e.sha,
        size: e.size,
      })),
      truncated: Boolean(t.truncated),
    };
  }

  /** blobをbase64で取得する（最大100MB）。 */
  async getBlobBase64(repo: RepoRef, sha: string): Promise<string> {
    const b = await this.request<any>("GET", `/repos/${repo.owner}/${repo.name}/git/blobs/${sha}`);
    return b.content as string;
  }

  async getBlobText(repo: RepoRef, sha: string): Promise<string> {
    return base64ToUtf8(await this.getBlobBase64(repo, sha));
  }

  async createBlob(repo: RepoRef, change: CommitChange): Promise<string> {
    const body = change.contentBase64 != null
      ? { content: change.contentBase64, encoding: "base64" }
      : { content: utf8ToBase64(change.content ?? ""), encoding: "base64" };
    const r = await this.request<any>("POST", `/repos/${repo.owner}/${repo.name}/git/blobs`, body);
    return r.sha as string;
  }

  /**
   * 複数ファイルの追加/更新/削除を1コミットとして親parentShaの上に作り、branchのrefを更新する。
   * refがparentShaから進んでいた場合、GitHubがfast-forwardでない更新を422で拒否する
   * （= 競合検知）。成功時は新しいcommit shaと各blob shaを返す。
   */
  async commitChanges(
    repo: RepoRef,
    branch: string,
    parentSha: string,
    message: string,
    changes: CommitChange[]
  ): Promise<CommitResult> {
    const parent = await this.getCommit(repo, parentSha);
    const blobShas = new Map<string, string>();
    const treeEntries: any[] = [];
    for (const change of changes) {
      if (change.delete) {
        treeEntries.push({ path: change.path, mode: "100644", type: "blob", sha: null });
      } else {
        const sha = await this.createBlob(repo, change);
        blobShas.set(change.path, sha);
        treeEntries.push({ path: change.path, mode: "100644", type: "blob", sha });
      }
    }
    const tree = await this.request<any>("POST", `/repos/${repo.owner}/${repo.name}/git/trees`, {
      base_tree: parent.treeSha,
      tree: treeEntries,
    });
    const commit = await this.request<any>("POST", `/repos/${repo.owner}/${repo.name}/git/commits`, {
      message,
      tree: tree.sha,
      parents: [parentSha],
    });
    // force: false — parentShaがrefの現在値でなければ422になり、呼び出し側が競合処理する
    await this.request<any>(
      "PATCH",
      `/repos/${repo.owner}/${repo.name}/git/refs/${encodeURIComponent(`heads/${branch}`)}`,
      { sha: commit.sha, force: false }
    );
    return { commitSha: commit.sha, treeSha: tree.sha, blobShas };
  }
}
