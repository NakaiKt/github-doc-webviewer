/**
 * GitHub Alerts（`> [!NOTE]` 等）の共通ロジック。
 * 記法: https://docs.github.com/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#alerts
 *
 * 保存されるのはGitHubがそのまま解釈するプレーンな引用記法なので、
 * このアプリを使わずGitHub上で見ても同じ見た目になる。
 */

export const ALERT_KINDS = ["note", "tip", "important", "warning", "caution"] as const;

export type AlertKind = (typeof ALERT_KINDS)[number];

export const ALERT_LABELS: Record<AlertKind, string> = {
  note: "Note",
  tip: "Tip",
  important: "Important",
  warning: "Warning",
  caution: "Caution",
};

const KINDS_PATTERN = "NOTE|TIP|IMPORTANT|WARNING|CAUTION";

/** 引用記号を取り除いた1行がアラートのマーカーなら種別を返す。 */
export function matchAlertMarker(line: string): AlertKind | null {
  const m = line.match(new RegExp(`^[ \\t]*\\[!(${KINDS_PATTERN})\\][ \\t]*$`, "i"));
  return m ? (m[1].toLowerCase() as AlertKind) : null;
}

/** `> [!NOTE]` 形式のマーカー行（インデント可）。 */
export const ALERT_QUOTE_MARKER_RE = new RegExp(
  `^([ \\t]*)>[ \\t]*\\[!(${KINDS_PATTERN})\\][ \\t]*$`,
  "i"
);

/**
 * Crepe（remark-stringify）が書き出したアラートをGitHubの正準形へ戻す。
 * - `> \[!NOTE]` / `> \[!NOTE\]` のエスケープを解除する
 * - 行末のハードブレーク `\` を落とす（マーカー行に付くとGitHubが認識しなくなる）
 * - マーカー直後の `>` だけの空行を畳む（Crepeは本文を別段落として書き出すため）
 */
export function normalizeAlerts(md: string): string {
  const escaped = new RegExp(
    `^([ \\t]*)>[ \\t]*\\\\?\\[!(${KINDS_PATTERN})\\\\?\\][ \\t]*\\\\?[ \\t]*$`,
    "i"
  );
  const lines = md.split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(escaped);
    if (!m) {
      out.push(lines[i]);
      continue;
    }
    out.push(`${m[1]}> [!${m[2].toUpperCase()}]`);
    const next = lines[i + 1];
    const after = lines[i + 2];
    if (next?.trim() === ">" && after != null && after.trimStart().startsWith(">")) {
      i++; // 空の引用行を捨てて本文をマーカーの直後につなげる
    }
  }

  return out.join("\n");
}
