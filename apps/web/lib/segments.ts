/**
 * 閲覧モード描画のための本文分割。
 * - 行単位で走査し、コードフェンス内は素通しする
 * - 単独行の埋め込み `![[target]]` を embed セグメントに
 * - `> [!NOTE]` 等のGitHub Alertsブロックを alert セグメントに
 * - ```mermaid ブロックを mermaid セグメントに
 */

export type Segment =
  | { type: "md"; text: string }
  | { type: "embed"; target: string }
  | { type: "alert"; kind: AlertKind; inner: string }
  | { type: "mermaid"; code: string };

export type AlertKind = "note" | "tip" | "important" | "warning" | "caution";

const EMBED_LINE_RE = /^!\[\[([^\]\n]+)\]\]\s*$/;
const ALERT_START_RE = /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i;
const FENCE_RE = /^(\s*)(```+|~~~+)(.*)$/;
const BLOCK_MARKER_RE = /\s\^[A-Za-z0-9-]+\s*$/;

/** 行末のブロックIDマーカー（` ^abc123`）は閲覧時には表示しない（Obsidian互換） */
function stripBlockMarker(line: string): string {
  return line.replace(BLOCK_MARKER_RE, "");
}

export function parseSegments(body: string): Segment[] {
  const lines = body.split("\n");
  const segments: Segment[] = [];
  let buf: string[] = [];

  const flush = () => {
    if (buf.length > 0) {
      const text = buf.join("\n");
      if (text.trim()) segments.push({ type: "md", text });
      buf = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(FENCE_RE);
    if (fence) {
      const marker = fence[2];
      const info = fence[3].trim().toLowerCase();
      // フェンス終端を探す
      let j = i + 1;
      while (j < lines.length && !lines[j].trim().startsWith(marker.slice(0, 3))) j++;
      if (info === "mermaid") {
        flush();
        segments.push({ type: "mermaid", code: lines.slice(i + 1, j).join("\n") });
      } else {
        buf.push(...lines.slice(i, Math.min(j + 1, lines.length)));
      }
      i = j + 1;
      continue;
    }

    const embed = line.match(EMBED_LINE_RE);
    if (embed) {
      flush();
      segments.push({ type: "embed", target: embed[1] });
      i++;
      continue;
    }

    const alert = line.match(ALERT_START_RE);
    if (alert) {
      // 続くblockquote行を集める
      let j = i + 1;
      const inner: string[] = [];
      while (j < lines.length && /^>/.test(lines[j])) {
        inner.push(stripBlockMarker(lines[j].replace(/^>\s?/, "")));
        j++;
      }
      flush();
      segments.push({
        type: "alert",
        kind: alert[1].toLowerCase() as AlertKind,
        inner: inner.join("\n"),
      });
      i = j;
      continue;
    }

    buf.push(stripBlockMarker(line));
    i++;
  }
  flush();
  return segments;
}
