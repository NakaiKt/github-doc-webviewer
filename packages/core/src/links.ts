import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import type { Root, Link, Image, Definition, Text } from "mdast";
import {
  dirname,
  encodeLinkPath,
  isRelativeUrl,
  relativeTo,
  resolveRelative,
  splitAnchor,
} from "./paths";

export type LinkKind = "link" | "image" | "definition" | "embed";

export interface LinkRef {
  /** ファイル内に書かれているままのURL/ターゲット文字列（アンカー含む） */
  url: string;
  /** URL部分の開始オフセット（markdown全体基準） */
  start: number;
  /** URL部分の終了オフセット */
  end: number;
  kind: LinkKind;
}

const parser = unified().use(remarkParse).use(remarkGfm);

export const EMBED_RE = /!\[\[([^\]\n]+)\]\]/g;

function parseTree(markdown: string): Root {
  return parser.parse(markdown) as Root;
}

/** slice内のoffsetから、`<url>` または 裸URL（空白か対応しない `)` まで）を読み取る。 */
function readUrlSpan(src: string, from: number): { start: number; end: number } | null {
  let i = from;
  while (i < src.length && (src[i] === " " || src[i] === "\t" || src[i] === "\n")) i++;
  if (i >= src.length) return null;
  if (src[i] === "<") {
    const close = src.indexOf(">", i + 1);
    if (close === -1) return null;
    return { start: i + 1, end: close };
  }
  const start = i;
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") {
      if (depth === 0) break;
      depth--;
    } else if (c === " " || c === "\t" || c === "\n") break;
    i++;
  }
  return { start, end: i };
}

/**
 * Markdown中のリンク/画像/リンク定義/埋め込み（![[...]]）のURL部分を、
 * 元テキスト上の正確なオフセット付きで列挙する。コードブロック内は対象外。
 */
export function scanLinks(markdown: string): LinkRef[] {
  const tree = parseTree(markdown);
  const refs: LinkRef[] = [];
  const codeRanges: Array<[number, number]> = [];

  visit(tree, (node) => {
    const pos = node.position;
    if (!pos || pos.start.offset == null || pos.end.offset == null) return;
    const startOff = pos.start.offset;
    const endOff = pos.end.offset;

    if (node.type === "code" || node.type === "inlineCode") {
      codeRanges.push([startOff, endOff]);
      return;
    }

    if (node.type === "link") {
      const link = node as Link;
      // `[text](url)` — リンクテキスト末尾の後の `](` の直後からURLが始まる
      let searchFrom = startOff + 1;
      const last = link.children[link.children.length - 1];
      if (last?.position?.end.offset != null) searchFrom = last.position.end.offset;
      const closeIdx = markdown.indexOf("](", searchFrom);
      if (closeIdx === -1 || closeIdx >= endOff) return; // autolink 等
      const span = readUrlSpan(markdown, closeIdx + 2);
      if (span && span.end <= endOff) {
        refs.push({ url: markdown.slice(span.start, span.end), start: span.start, end: span.end, kind: "link" });
      }
    } else if (node.type === "image") {
      const img = node as Image;
      void img;
      const closeIdx = markdown.indexOf("](", startOff);
      if (closeIdx === -1 || closeIdx >= endOff) return;
      const span = readUrlSpan(markdown, closeIdx + 2);
      if (span && span.end <= endOff) {
        refs.push({ url: markdown.slice(span.start, span.end), start: span.start, end: span.end, kind: "image" });
      }
    } else if (node.type === "definition") {
      const def = node as Definition;
      void def;
      const colonIdx = markdown.indexOf("]:", startOff);
      if (colonIdx === -1 || colonIdx >= endOff) return;
      const span = readUrlSpan(markdown, colonIdx + 2);
      if (span && span.end <= endOff) {
        refs.push({ url: markdown.slice(span.start, span.end), start: span.start, end: span.end, kind: "definition" });
      }
    } else if (node.type === "text") {
      // 埋め込み記法 ![[path#^block]] はテキストノード内に現れる
      const text = node as Text;
      const raw = markdown.slice(startOff, endOff);
      EMBED_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = EMBED_RE.exec(raw)) !== null) {
        const s = startOff + m.index + 3; // `![[` の後
        refs.push({ url: m[1], start: s, end: s + m[1].length, kind: "embed" });
      }
      void text;
    }
  });

  return refs
    .filter((r) => !codeRanges.some(([s, e]) => r.start >= s && r.end <= e))
    .sort((a, b) => a.start - b.start);
}

/** scanLinksの結果に対して書き換え関数を適用する。nullを返した参照はそのまま。 */
export function rewriteLinks(
  markdown: string,
  rewrite: (ref: LinkRef) => string | null
): string {
  const refs = scanLinks(markdown);
  let out = markdown;
  for (let i = refs.length - 1; i >= 0; i--) {
    const ref = refs[i];
    const next = rewrite(ref);
    if (next != null && next !== ref.url) {
      out = out.slice(0, ref.start) + next + out.slice(ref.end);
    }
  }
  return out;
}

/**
 * ドキュメント自身が oldPath → newPath へ移動したとき、
 * 本文中の相対リンク（他ドキュメント・画像・埋め込み）を移動後の階層から見たパスに書き換える。
 */
export function updateLinksForMovedDoc(content: string, oldPath: string, newPath: string): string {
  const oldDir = dirname(oldPath);
  const newDir = dirname(newPath);
  if (oldDir === newDir) return content;
  return rewriteLinks(content, (ref) => {
    const { path, anchor } = splitAnchor(ref.url);
    if (!path || !isRelativeUrl(path)) return null;
    const abs = resolveRelative(oldDir, path);
    const rel = relativeTo(newDir, abs);
    return ref.kind === "embed" ? rel + anchor : encodeLinkPath(rel) + anchor;
  });
}

/**
 * 他ファイル content（パス contentPath）内の、movedFrom を指す相対リンクを movedTo に付け替える。
 */
export function updateLinksToMovedFile(
  content: string,
  contentPath: string,
  movedFrom: string,
  movedTo: string
): string {
  const dir = dirname(contentPath);
  return rewriteLinks(content, (ref) => {
    const { path, anchor } = splitAnchor(ref.url);
    if (!path || !isRelativeUrl(path)) return null;
    if (resolveRelative(dir, path) !== movedFrom) return null;
    const rel = relativeTo(dir, movedTo);
    return ref.kind === "embed" ? rel + anchor : encodeLinkPath(rel) + anchor;
  });
}
