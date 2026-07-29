import { normalizeAlerts } from "@docvault/core";

/**
 * Crepe（remark-stringify）はテキスト中の `[` を `\[` にエスケープするため、
 * GitHub Alerts / 埋め込み / 脚注の各記法が保存時に壊れる。
 * 保存前にこれらのエスケープを元の記法へ戻し、GitHub上でもそのまま
 * レンダリングされるプレーンMarkdownを維持する。
 */
export function normalizeCrepeMarkdown(md: string): string {
  // GitHub Alerts: `> \[!NOTE]` → `> [!NOTE]`（行末のハードブレーク・空引用行の除去も含む）
  let out = normalizeAlerts(md);
  // 埋め込みブロック: `!\[\[target]]` → `![[target]]`
  out = out.replace(/!\\?\[\\?\[([^\]\n]+?)\\?\]\\?\]/g, "![[$1]]");
  // 脚注: `\[^1]` → `[^1]`
  out = out.replace(/\\\[(\^[^\]\n]+)\]/g, "[$1]");
  return out;
}
