/**
 * 目次（TOC）のための見出し抽出。
 *
 * 閲覧モード・編集モードのどちらでも同じ順序で並ぶよう、
 * **描画対象になる本文トップレベルの見出しだけ**を拾う:
 * - コードフェンス内の `# ...` は見出しではない
 * - 引用（Alerts含む）の中に入った見出しは対象外
 *   （閲覧モードではAlertコンポーネントの内側に描画され、トップレベルに出てこないため）
 * - インデント4文字以上はコードブロック/リスト本文なので対象外（CommonMark準拠）
 */

export interface DocHeading {
  /** 1〜6 */
  level: number;
  /** インライン記法を取り除いた見出しテキスト */
  text: string;
}

const ATX_RE = /^ {0,3}(#{1,6})[ \t]+(.*)$/;
const FENCE_RE = /^\s*(```+|~~~+)/;

/** 見出しのインライン記法（強調・コード・リンク・画像）を素のテキストに落とす。 */
function stripInline(raw: string): string {
  return raw
    .replace(/[ \t]+#+[ \t]*$/, "") // 閉じATX（`## 見出し ##`）
    .replace(/!\[\[([^\]\n]+)\]\]/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`+([^`]*)`+/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/\s+\^[A-Za-z0-9-]+$/, "") // 行末ブロックIDマーカー
    .trim();
}

export function parseHeadings(body: string): DocHeading[] {
  const headings: DocHeading[] = [];
  let fence: string | null = null;

  for (const line of body.split("\n")) {
    const f = line.match(FENCE_RE);
    if (f) {
      const marker = f[1].slice(0, 3);
      if (fence == null) fence = marker;
      else if (marker === fence) fence = null;
      continue;
    }
    if (fence != null) continue;
    if (/^\s*>/.test(line)) continue;

    const m = line.match(ATX_RE);
    if (!m) continue;
    const text = stripInline(m[2]);
    if (!text) continue;
    headings.push({ level: m[1].length, text });
  }

  return headings;
}
