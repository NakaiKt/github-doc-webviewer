/**
 * リポジトリ内パスはすべて posix 形式・リポジトリルート起点（先頭スラッシュなし）で扱う。
 */

export function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

export function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}

export function extname(path: string): string {
  const base = basename(path);
  const i = base.lastIndexOf(".");
  return i <= 0 ? "" : base.slice(i).toLowerCase();
}

export function joinPath(...parts: string[]): string {
  return normalizePath(parts.filter(Boolean).join("/"));
}

/** `.` / `..` セグメントを解決する。ルートより上へ出る `..` は捨てる。 */
export function normalizePath(path: string): string {
  const out: string[] = [];
  for (const seg of path.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      out.pop();
    } else {
      out.push(seg);
    }
  }
  return out.join("/");
}

/** fromDir（ディレクトリパス、ルートは ""）から相対 URL をリポジトリ内絶対パスへ解決する。 */
export function resolveRelative(fromDir: string, rel: string): string {
  let decoded = rel;
  try {
    decoded = decodeURI(rel);
  } catch {
    // 不正なエンコードはそのまま扱う
  }
  if (decoded.startsWith("/")) return normalizePath(decoded);
  return normalizePath(fromDir ? `${fromDir}/${decoded}` : decoded);
}

/** fromDir から toPath への相対パス（Obsidian 互換の `../` 形式、`./` プレフィックスなし）を返す。 */
export function relativeTo(fromDir: string, toPath: string): string {
  const from = fromDir ? fromDir.split("/") : [];
  const to = toPath.split("/");
  let common = 0;
  while (common < from.length && common < to.length - 1 && from[common] === to[common]) {
    common++;
  }
  const ups = from.length - common;
  const rest = to.slice(common).join("/");
  return "../".repeat(ups) + rest;
}

/** URL をパス部とアンカー部（`#...`、なければ ""）に分ける。 */
export function splitAnchor(url: string): { path: string; anchor: string } {
  const i = url.indexOf("#");
  if (i === -1) return { path: url, anchor: "" };
  return { path: url.slice(0, i), anchor: url.slice(i) };
}

const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/** 同一リポジトリ内を指す相対参照かどうか（http:, mailto:, //, #のみ 等を除外）。 */
export function isRelativeUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith("#")) return false;
  if (url.startsWith("//")) return false;
  if (SCHEME_RE.test(url)) return false;
  return true;
}

/** パスをMarkdownリンク用にエンコードする（スペース等のみ。/ や日本語は保持）。 */
export function encodeLinkPath(path: string): string {
  return path.replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");
}
