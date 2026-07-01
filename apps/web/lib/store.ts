import { create } from "zustand";
import {
  GitHubClient,
  GitHubApiError,
  type RepoInfo,
  type CommitChange,
  parseDoc,
  serializeDoc,
  setFrontmatterKey,
  docTitle,
  generateDocId,
  updateLinksForMovedDoc,
  updateLinksToMovedFile,
  basename,
  dirname,
  normalizePath,
  resolveRelative,
  isImagePath,
  findUnusedImages,
} from "@docvault/core";
import { rebuildSearchIndex } from "./search";
import { isDocPath, isVisibleDoc, TEMPLATES_DIR } from "./tree";
import { saveRepoSelection, saveToken } from "./settings";

export interface FileEntry {
  path: string;
  /** 同期済みblob sha。ローカル新規作成でまだpushしていなければ null */
  sha: string | null;
  size: number;
  isMarkdown: boolean;
  /** mdファイルのみロードされるテキスト内容 */
  content: string | null;
  /** 未pushのバイナリ内容（base64） */
  binaryBase64: string | null;
  dirty: boolean;
  /** ローカル編集中にリモート側でも更新された（= push時に競合確認） */
  remoteChanged: boolean;
  remoteSha: string | null;
  /** リモート起因で内容が置き換わった回数（エディタ再マウント用） */
  extRev: number;
}

export interface ConflictState {
  paths: string[];
}

interface DocVaultState {
  token: string | null;
  client: GitHubClient | null;
  user: { login: string } | null;
  repo: RepoInfo | null;
  headSha: string | null;
  files: Record<string, FileEntry>;
  docIds: Record<string, string>; // id -> path
  loadState: "idle" | "loading" | "ready" | "error";
  loadError: string | null;
  syncing: boolean;
  lastSyncAt: number | null;
  dirtyCount: number;
  currentPath: string | null;
  view: { kind: "doc" } | { kind: "database" };
  conflict: ConflictState | null;
  toast: string | null;

  setToken: (token: string) => Promise<void>;
  clearToken: () => void;
  selectRepo: (repo: RepoInfo) => void;
  clearRepo: () => void;
  loadRepo: (requested?: { docId?: string; path?: string }) => Promise<void>;
  pull: () => Promise<void>;
  push: () => Promise<void>;
  syncNow: () => Promise<void>;
  saveLocal: (path: string, content: string) => void;
  openDoc: (path: string | null) => void;
  openDatabase: () => void;
  ensureDocId: (path: string) => string | null;
  createDoc: (dir: string, title: string, templatePath?: string | null) => Promise<string | null>;
  deleteDoc: (path: string) => Promise<void>;
  moveDoc: (oldPath: string, newPath: string) => Promise<boolean>;
  uploadAsset: (fileName: string, base64: string) => string;
  deleteFiles: (paths: string[]) => Promise<void>;
  writeBackBlock: (sourcePath: string, newContent: string) => void;
  resolveConflict: (mode: "theirs" | "mine") => Promise<void>;
  setToast: (msg: string | null) => void;
  getUnusedImages: () => string[];
}

const BRANCH = "main";

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

/** 編集停止後のデバウンスpush（連続コミット防止） */
const PUSH_DEBOUNCE_MS = 5000;

function repoRef(repo: RepoInfo) {
  return { owner: repo.owner, name: repo.name };
}

function computeDocIds(files: Record<string, FileEntry>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const f of Object.values(files)) {
    if (!f.isMarkdown || f.content == null) continue;
    const { frontmatter } = parseDoc(f.content);
    if (typeof frontmatter.id === "string" && frontmatter.id) {
      map[frontmatter.id] = f.path;
    }
  }
  return map;
}

function refreshSearch(files: Record<string, FileEntry>) {
  const docs = Object.values(files)
    .filter((f) => f.isMarkdown && f.content != null && isVisibleDoc(f.path))
    .map((f) => {
      const { body } = parseDoc(f.content!);
      return {
        path: f.path,
        title: docTitle(f.content!, basename(f.path).replace(/\.md$/, "")),
        text: body,
      };
    });
  rebuildSearchIndex(docs);
}

function countDirty(files: Record<string, FileEntry>): number {
  return Object.values(files).filter((f) => f.dirty).length;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

function updateUrl(repo: RepoInfo | null, docId: string | null, path: string | null) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  if (repo) params.set("repo", `${repo.owner}/${repo.name}`);
  if (docId) params.set("doc", docId);
  else if (path) params.set("path", path);
  const qs = params.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

export const useStore = create<DocVaultState>((set, get) => {
  /** state.filesを更新しつつ派生情報（検索・ID索引・dirty数）を再計算する */
  const setFiles = (files: Record<string, FileEntry>) => {
    refreshSearch(files);
    set({ files, docIds: computeDocIds(files), dirtyCount: countDirty(files) });
  };

  const schedulePush = () => {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      void get().push();
    }, PUSH_DEBOUNCE_MS);
  };

  /** リモートの最新ツリーを取り込み、競合をマークする。 */
  const doPull = async (): Promise<void> => {
    const { client, repo, headSha } = get();
    if (!client || !repo) return;
    const ref = repoRef(repo);
    const remoteHead = await client.getRefSha(ref, BRANCH);
    if (remoteHead === headSha) {
      set({ lastSyncAt: Date.now() });
      return;
    }
    const commit = await client.getCommit(ref, remoteHead);
    const { entries } = await client.getTreeRecursive(ref, commit.treeSha);
    const prev = get().files;
    const next: Record<string, FileEntry> = {};
    const toFetch: Array<{ path: string; sha: string }> = [];

    for (const e of entries) {
      if (e.type !== "blob") continue;
      const isMd = isDocPath(e.path);
      const old = prev[e.path];
      if (old && old.sha === e.sha) {
        next[e.path] = old;
        continue;
      }
      if (old?.dirty) {
        // ローカル編集中にリモートも更新された → 競合候補としてマーク
        next[e.path] = { ...old, remoteChanged: true, remoteSha: e.sha };
        continue;
      }
      next[e.path] = {
        path: e.path,
        sha: e.sha,
        size: e.size ?? 0,
        isMarkdown: isMd,
        content: old?.content ?? null,
        binaryBase64: null,
        dirty: false,
        remoteChanged: false,
        remoteSha: null,
        extRev: (old?.extRev ?? 0) + (old?.content != null ? 1 : 0),
      };
      if (isMd) toFetch.push({ path: e.path, sha: e.sha });
    }

    // リモートに存在しないがローカルでdirtyなファイル（新規作成 or リモートで削除済み）は残す
    for (const [path, entry] of Object.entries(prev)) {
      if (!next[path] && entry.dirty) {
        next[path] = { ...entry, sha: null };
      }
    }

    await mapLimit(toFetch, 8, async ({ path, sha }) => {
      const text = await client.getBlobText(ref, sha);
      const entry = next[path];
      if (entry) next[path] = { ...entry, content: text };
    });

    set({ headSha: remoteHead, lastSyncAt: Date.now() });
    setFiles(next);
  };

  /** dirtyなファイルを1コミットにまとめてpushする。競合時はダイアログを開く。 */
  const doPush = async (): Promise<void> => {
    const { client, repo } = get();
    if (!client || !repo) return;
    const ref = repoRef(repo);

    for (let attempt = 0; attempt < 3; attempt++) {
      const { files, headSha } = get();
      const dirtyEntries = Object.values(files).filter((f) => f.dirty);
      if (dirtyEntries.length === 0) return;

      const remoteHead = await client.getRefSha(ref, BRANCH);
      if (remoteHead !== headSha) {
        await doPull();
      }
      const conflicted = Object.values(get().files).filter((f) => f.dirty && f.remoteChanged);
      if (conflicted.length > 0) {
        set({ conflict: { paths: conflicted.map((f) => f.path) } });
        return;
      }

      const current = get();
      const targets = Object.values(current.files).filter((f) => f.dirty);
      if (targets.length === 0) return;
      const changes: CommitChange[] = targets.map((f) =>
        f.binaryBase64 != null
          ? { path: f.path, contentBase64: f.binaryBase64 }
          : { path: f.path, content: f.content ?? "" }
      );
      const message =
        targets.length === 1 ? `docs: update ${targets[0].path}` : `docs: update ${targets.length} files`;
      try {
        const result = await client.commitChanges(ref, BRANCH, current.headSha!, message, changes);
        const nextFiles = { ...get().files };
        for (const t of targets) {
          const entry = nextFiles[t.path];
          if (!entry) continue;
          nextFiles[t.path] = {
            ...entry,
            sha: result.blobShas.get(t.path) ?? entry.sha,
            dirty: entry.content === t.content && entry.binaryBase64 === t.binaryBase64 ? false : entry.dirty,
            binaryBase64: null,
            remoteChanged: false,
            remoteSha: null,
          };
        }
        set({ headSha: result.commitSha, lastSyncAt: Date.now() });
        setFiles(nextFiles);
        return;
      } catch (e) {
        if (e instanceof GitHubApiError && (e.status === 422 || e.status === 409)) {
          // refがズレた（他の人が同時push） → pullして再試行
          continue;
        }
        throw e;
      }
    }
    get().setToast("同期に失敗しました。時間をおいて再試行してください");
  };

  /** 即時に複数ファイルの変更を1コミットでpushする（移動・削除用）。競合時はfalse。 */
  const commitNow = async (message: string, changes: CommitChange[]): Promise<Map<string, string> | null> => {
    const { client, repo } = get();
    if (!client || !repo) return null;
    const ref = repoRef(repo);
    for (let attempt = 0; attempt < 3; attempt++) {
      const { headSha } = get();
      try {
        const result = await client.commitChanges(ref, BRANCH, headSha!, message, changes);
        set({ headSha: result.commitSha, lastSyncAt: Date.now() });
        return result.blobShas;
      } catch (e) {
        if (e instanceof GitHubApiError && (e.status === 422 || e.status === 409)) {
          await doPull();
          const conflicted = Object.values(get().files).filter((f) => f.dirty && f.remoteChanged);
          if (conflicted.length > 0) {
            set({ conflict: { paths: conflicted.map((f) => f.path) } });
            return null;
          }
          continue;
        }
        throw e;
      }
    }
    return null;
  };

  return {
    token: null,
    client: null,
    user: null,
    repo: null,
    headSha: null,
    files: {},
    docIds: {},
    loadState: "idle",
    loadError: null,
    syncing: false,
    lastSyncAt: null,
    dirtyCount: 0,
    currentPath: null,
    view: { kind: "doc" },
    conflict: null,
    toast: null,

    setToast: (msg) => {
      set({ toast: msg });
      if (toastTimer) clearTimeout(toastTimer);
      if (msg) {
        toastTimer = setTimeout(() => set({ toast: null }), 4000);
      }
    },

    setToken: async (token) => {
      const client = new GitHubClient(token);
      const user = await client.getUser(); // 無効なPATならここで例外
      saveToken(token);
      set({ token, client, user: { login: user.login } });
    },

    clearToken: () => {
      saveToken(null);
      saveRepoSelection(null);
      set({
        token: null,
        client: null,
        user: null,
        repo: null,
        files: {},
        docIds: {},
        headSha: null,
        loadState: "idle",
        currentPath: null,
      });
      updateUrl(null, null, null);
    },

    selectRepo: (repo) => {
      saveRepoSelection({ owner: repo.owner, name: repo.name });
      set({ repo, loadState: "idle", files: {}, docIds: {}, headSha: null, currentPath: null });
    },

    clearRepo: () => {
      saveRepoSelection(null);
      set({ repo: null, files: {}, docIds: {}, headSha: null, loadState: "idle", currentPath: null });
      updateUrl(null, null, null);
    },

    loadRepo: async (requested) => {
      const { repo } = get();
      if (!repo) return;
      set({ loadState: "loading", loadError: null });
      try {
        await doPull();
        set({ loadState: "ready" });
        // 共有リンク（doc=ID / path=）で指定されたドキュメントを開く
        if (requested?.docId) {
          const path = get().docIds[requested.docId];
          if (path) get().openDoc(path);
          else get().setToast("指定されたドキュメントIDが見つかりませんでした");
        } else if (requested?.path && get().files[requested.path]) {
          get().openDoc(requested.path);
        }
      } catch (e) {
        set({
          loadState: "error",
          loadError: e instanceof Error ? e.message : String(e),
        });
      }
    },

    pull: async () => {
      if (get().syncing) return;
      set({ syncing: true });
      try {
        await doPull();
      } finally {
        set({ syncing: false });
      }
    },

    push: async () => {
      if (get().syncing) return;
      set({ syncing: true });
      try {
        await doPush();
      } catch (e) {
        get().setToast(`同期エラー: ${e instanceof Error ? e.message : e}`);
      } finally {
        set({ syncing: false });
      }
    },

    syncNow: async () => {
      if (get().syncing) return;
      set({ syncing: true });
      try {
        await doPull();
        await doPush();
      } catch (e) {
        get().setToast(`同期エラー: ${e instanceof Error ? e.message : e}`);
      } finally {
        set({ syncing: false });
      }
    },

    saveLocal: (path, content) => {
      const files = { ...get().files };
      const old = files[path];
      files[path] = old
        ? { ...old, content, dirty: true }
        : {
            path,
            sha: null,
            size: content.length,
            isMarkdown: isDocPath(path),
            content,
            binaryBase64: null,
            dirty: true,
            remoteChanged: false,
            remoteSha: null,
            extRev: 0,
          };
      setFiles(files);
      schedulePush();
    },

    openDoc: (path) => {
      set({ currentPath: path, view: { kind: "doc" } });
      const { repo, files } = get();
      if (!path) {
        updateUrl(repo, null, null);
        return;
      }
      const entry = files[path];
      let docId: string | null = null;
      if (entry?.content != null) {
        const { frontmatter } = parseDoc(entry.content);
        if (typeof frontmatter.id === "string" && frontmatter.id) docId = frontmatter.id;
        else docId = get().ensureDocId(path);
      }
      updateUrl(repo, docId, path);
    },

    openDatabase: () => {
      set({ view: { kind: "database" }, currentPath: null });
      updateUrl(get().repo, null, null);
    },

    /** 遅延ID付与: 開いた/編集したタイミングでfrontmatterにIDを採番する。 */
    ensureDocId: (path) => {
      const entry = get().files[path];
      if (!entry || entry.content == null || !entry.isMarkdown) return null;
      const { frontmatter } = parseDoc(entry.content);
      if (typeof frontmatter.id === "string" && frontmatter.id) return frontmatter.id;
      const id = generateDocId();
      get().saveLocal(path, setFrontmatterKey(entry.content, "id", id));
      return id;
    },

    createDoc: async (dir, title, templatePath) => {
      const { files } = get();
      const safe = title.trim().replace(/[\\/#?%*:|"<>]/g, "-") || "無題";
      let path = normalizePath(dir ? `${dir}/${safe}.md` : `${safe}.md`);
      let n = 2;
      while (files[path]) {
        path = normalizePath(dir ? `${dir}/${safe}-${n}.md` : `${safe}-${n}.md`);
        n++;
      }
      const id = generateDocId();
      let content: string;
      const template = templatePath ? files[templatePath] : null;
      if (template?.content) {
        const { frontmatter, body } = parseDoc(template.content);
        const date = new Date().toISOString().slice(0, 10);
        const name = title.trim() || safe;
        const fill = (v: unknown): unknown => {
          if (typeof v === "string") return v.replaceAll("{{title}}", name).replaceAll("{{date}}", date);
          if (Array.isArray(v)) return v.map(fill);
          if (v && typeof v === "object") {
            return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)]));
          }
          return v;
        };
        const fm = { ...(fill(frontmatter) as Record<string, unknown>), id, title: name };
        const filledBody = fill(body) as string;
        content = serializeDoc(fm, filledBody);
      } else {
        content = `---\nid: ${id}\ntitle: ${JSON.stringify(title.trim() || safe)}\n---\n\n# ${title.trim() || safe}\n\n`;
      }
      get().saveLocal(path, content);
      get().openDoc(path);
      return path;
    },

    deleteDoc: async (path) => {
      const blobShas = await commitNow(`docs: delete ${path}`, [{ path, delete: true }]);
      if (blobShas == null && get().conflict) return;
      const files = { ...get().files };
      delete files[path];
      setFiles(files);
      if (get().currentPath === path) get().openDoc(null);
      get().setToast(`${basename(path)} を削除しました`);
    },

    /**
     * ドキュメント移動。移動するファイル自身の相対リンク（画像含む）と、
     * このファイルを参照している全ファイルの相対リンクを書き換えて1コミットでpushする。
     */
    moveDoc: async (oldPath, newPath) => {
      newPath = normalizePath(newPath);
      if (!newPath || newPath === oldPath) return false;
      const state = get();
      if (state.files[newPath]) {
        state.setToast("移動先に同名ファイルが存在します");
        return false;
      }
      // 未pushの編集を先に反映してから移動する（リンク書き換えの基準を一意にする）
      if (state.dirtyCount > 0) {
        await doPush();
        if (get().conflict) return false;
      }
      const files = get().files;
      const moved = files[oldPath];
      if (!moved || moved.content == null) return false;

      const movedContent = updateLinksForMovedDoc(moved.content, oldPath, newPath);
      const changes: CommitChange[] = [
        { path: newPath, content: movedContent },
        { path: oldPath, delete: true },
      ];
      const rewritten: Array<{ path: string; content: string }> = [];
      for (const f of Object.values(files)) {
        if (f.path === oldPath || !f.isMarkdown || f.content == null) continue;
        const updated = updateLinksToMovedFile(f.content, f.path, oldPath, newPath);
        if (updated !== f.content) {
          changes.push({ path: f.path, content: updated });
          rewritten.push({ path: f.path, content: updated });
        }
      }
      const blobShas = await commitNow(`docs: move ${oldPath} -> ${newPath}`, changes);
      if (blobShas == null) return false;

      const next = { ...get().files };
      delete next[oldPath];
      next[newPath] = {
        ...moved,
        path: newPath,
        content: movedContent,
        sha: blobShas.get(newPath) ?? null,
        dirty: false,
        remoteChanged: false,
        remoteSha: null,
      };
      for (const r of rewritten) {
        const entry = next[r.path];
        if (entry) {
          next[r.path] = {
            ...entry,
            content: r.content,
            sha: blobShas.get(r.path) ?? entry.sha,
            extRev: entry.extRev + 1,
          };
        }
      }
      setFiles(next);
      if (get().currentPath === oldPath) get().openDoc(newPath);
      get().setToast(
        rewritten.length > 0
          ? `移動しました（${rewritten.length}ファイルのリンクを自動更新）`
          : "移動しました"
      );
      return true;
    },

    /** 画像等のバイナリをassets/に追加する（次回push時にコミットされる）。 */
    uploadAsset: (fileName, base64) => {
      const safe = fileName.replace(/[^\w.\-()（）　-鿿]/g, "_");
      const stamp = Date.now().toString(36);
      let path = `assets/${stamp}-${safe}`;
      const files = { ...get().files };
      let n = 2;
      while (files[path]) {
        path = `assets/${stamp}-${n}-${safe}`;
        n++;
      }
      files[path] = {
        path,
        sha: null,
        size: Math.floor(base64.length * 0.75),
        isMarkdown: false,
        content: null,
        binaryBase64: base64,
        dirty: true,
        remoteChanged: false,
        remoteSha: null,
        extRev: 0,
      };
      setFiles(files);
      schedulePush();
      return path;
    },

    deleteFiles: async (paths) => {
      if (paths.length === 0) return;
      const changes: CommitChange[] = paths.map((path) => ({ path, delete: true }));
      const result = await commitNow(`docs: delete ${paths.length} unused assets`, changes);
      if (result == null && get().conflict) return;
      const files = { ...get().files };
      for (const p of paths) delete files[p];
      setFiles(files);
      get().setToast(`${paths.length}件のファイルを削除しました`);
    },

    /** 埋め込みブロックの書き戻し: 実体ファイルの内容を更新して通常の保存フローに乗せる。 */
    writeBackBlock: (sourcePath, newContent) => {
      get().saveLocal(sourcePath, newContent);
      get().setToast("埋め込み元のファイルに書き戻しました");
    },

    resolveConflict: async (mode) => {
      const { conflict, client, repo } = get();
      if (!conflict || !client || !repo) return;
      const ref = repoRef(repo);
      const files = { ...get().files };
      for (const path of conflict.paths) {
        const entry = files[path];
        if (!entry) continue;
        if (mode === "theirs") {
          // リモートの内容を採用（ローカルの変更を破棄）
          const remoteSha = entry.remoteSha;
          if (remoteSha) {
            const text = entry.isMarkdown ? await client.getBlobText(ref, remoteSha) : null;
            files[path] = {
              ...entry,
              sha: remoteSha,
              content: text,
              dirty: false,
              remoteChanged: false,
              remoteSha: null,
              binaryBase64: null,
              extRev: entry.extRev + 1,
            };
          } else {
            delete files[path];
          }
        } else {
          // ローカルの内容で上書きpushする
          files[path] = { ...entry, sha: entry.remoteSha ?? entry.sha, remoteChanged: false, remoteSha: null };
        }
      }
      set({ conflict: null });
      setFiles(files);
      await get().push();
    },

    getUnusedImages: () => {
      const files = get().files;
      const mdFiles = Object.values(files)
        .filter((f) => f.isMarkdown && f.content != null)
        .map((f) => ({ path: f.path, content: f.content! }));
      const imagePaths = Object.keys(files).filter((p) => isImagePath(p));
      return findUnusedImages(mdFiles, imagePaths);
    },
  };
});

/** 相対パス・ルート相対・ファイル名のいずれかでリポジトリ内mdファイルを解決する。 */
export function resolveDocTarget(
  files: Record<string, FileEntry>,
  fromPath: string,
  target: string
): string | null {
  const clean = target.trim();
  if (!clean) return null;
  const candidates = [
    resolveRelative(dirname(fromPath), clean),
    normalizePath(clean),
  ];
  for (const c of candidates) {
    if (files[c]) return c;
    if (files[`${c}.md`]) return `${c}.md`;
  }
  // Obsidian風: ファイル名だけでの参照
  const name = basename(clean);
  const withMd = name.endsWith(".md") ? name : `${name}.md`;
  for (const p of Object.keys(files)) {
    if (basename(p) === withMd) return p;
  }
  return null;
}
