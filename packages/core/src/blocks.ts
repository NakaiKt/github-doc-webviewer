/**
 * Obsidian互換のブロックID（行末の ` ^block-id`）の検索・置換。
 * ブロック = マーカー行を含む、空行で区切られた連続行のまとまり（段落/リスト等）として扱う。
 */

export interface BlockMatch {
  /** ブロック先頭のオフセット */
  start: number;
  /** ブロック末尾のオフセット（マーカーを含む） */
  end: number;
  /** マーカー（` ^id`）を除いたブロック本文 */
  text: string;
}

function markerRe(blockId: string): RegExp {
  const escaped = blockId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)\\^${escaped}\\s*$`);
}

/** body から ^blockId を持つブロックを探す。 */
export function findBlock(body: string, blockId: string): BlockMatch | null {
  const re = markerRe(blockId);
  const lines = body.split("\n");
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (re.test(line)) {
      // マーカー行を含むブロック範囲（前後の空行まで）を求める
      let firstLine = i;
      while (firstLine > 0 && lines[firstLine - 1].trim() !== "") firstLine--;
      let lastLine = i;
      while (lastLine < lines.length - 1 && lines[lastLine + 1].trim() !== "") lastLine++;
      let start = 0;
      for (let j = 0; j < firstLine; j++) start += lines[j].length + 1;
      let end = start;
      for (let j = firstLine; j <= lastLine; j++) {
        end += lines[j].length + (j < lastLine ? 1 : 0);
      }
      const blockLines = lines.slice(firstLine, lastLine + 1);
      const markerIdx = i - firstLine;
      blockLines[markerIdx] = blockLines[markerIdx].replace(re, "").trimEnd();
      return { start, end, text: blockLines.join("\n") };
    }
    offset += line.length + 1;
  }
  void offset;
  return null;
}

/**
 * ^blockId のブロック本文を newText に置き換える（マーカーは末尾行に維持する）。
 * ブロックが見つからなければ null。
 */
export function replaceBlock(body: string, blockId: string, newText: string): string | null {
  const match = findBlock(body, blockId);
  if (!match) return null;
  const trimmed = newText.replace(/\s+$/, "");
  const replacement = `${trimmed} ^${blockId}`;
  return body.slice(0, match.start) + replacement + body.slice(match.end);
}

/** 埋め込みターゲット文字列（`path#^id` / `path` / `#^id`）を分解する。 */
export function parseEmbedTarget(target: string): { path: string; blockId: string | null } {
  const hashIdx = target.indexOf("#");
  if (hashIdx === -1) return { path: target.trim(), blockId: null };
  const path = target.slice(0, hashIdx).trim();
  const frag = target.slice(hashIdx + 1).trim();
  if (frag.startsWith("^")) return { path, blockId: frag.slice(1) };
  return { path, blockId: null };
}
