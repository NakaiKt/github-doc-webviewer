import { parseDoc } from "./frontmatter";
import { scanLinks } from "./links";
import { dirname, extname, isRelativeUrl, normalizePath, resolveRelative, splitAnchor } from "./paths";

export const IMAGE_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".bmp", ".ico",
]);

export function isImagePath(path: string): boolean {
  return IMAGE_EXTS.has(extname(path));
}

/** frontmatterの値を再帰的に走査し、画像パスらしき文字列を集める。 */
function collectFrontmatterImageValues(value: unknown, acc: string[]): void {
  if (typeof value === "string") {
    if (isImagePath(value)) acc.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectFrontmatterImageValues(v, acc);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectFrontmatterImageValues(v, acc);
  }
}

/**
 * 1つのMarkdownファイルが参照している画像のリポジトリ内絶対パス一覧。
 * 対象: 本文中のMarkdown画像/リンク/埋め込み + frontmatter内の画像指定（cover等、ネスト含む）。
 */
export function collectImageRefs(filePath: string, content: string): string[] {
  const dir = dirname(filePath);
  const refs = new Set<string>();
  const { frontmatter, body } = parseDoc(content);

  for (const ref of scanLinks(body)) {
    const { path } = splitAnchor(ref.url);
    if (!path || !isRelativeUrl(path)) continue;
    const abs = resolveRelative(dir, path);
    if (isImagePath(abs)) refs.add(abs);
  }

  const fmValues: string[] = [];
  collectFrontmatterImageValues(frontmatter, fmValues);
  for (const v of fmValues) {
    if (!isRelativeUrl(v)) continue;
    // frontmatterの画像はファイルからの相対 or リポジトリルートからのパスの両方を許容する
    refs.add(resolveRelative(dir, v));
    refs.add(normalizePath(v));
  }

  return [...refs];
}

/**
 * どのMarkdownからも参照されていない画像ファイルを検出する。
 * mdFiles: 全Markdownの {path, content}、imagePaths: リポジトリ内の全画像パス。
 */
export function findUnusedImages(
  mdFiles: Array<{ path: string; content: string }>,
  imagePaths: string[]
): string[] {
  const referenced = new Set<string>();
  for (const f of mdFiles) {
    for (const p of collectImageRefs(f.path, f.content)) referenced.add(p);
  }
  return imagePaths.filter((p) => !referenced.has(p));
}
