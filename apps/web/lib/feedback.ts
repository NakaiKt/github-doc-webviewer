import type { RepoRef } from "@docvault/core";

/**
 * 要望・不具合の送信先リポジトリ。フォークして自分で運用する場合は
 * NEXT_PUBLIC_FEEDBACK_REPO="owner/name" で差し替える（静的エクスポート時にビルドで埋め込まれる）。
 */
const SLUG = process.env.NEXT_PUBLIC_FEEDBACK_REPO || "NakaiKt/github-doc-webviewer";

export const FEEDBACK_REPO: RepoRef = {
  owner: SLUG.split("/")[0] ?? "",
  name: SLUG.split("/")[1] ?? "",
};

/** アプリ経由で作られたIssueを識別するマーカー。Actionsのラベル付与がこれを見る。 */
export const REQUEST_MARKER = "<!-- docvault-request -->";

/** GitHubのIssueタイトル上限。 */
export const TITLE_LIMIT = 256;

/** 入力本文にマーカーと送信元情報を付けて、Issue本文に整形する。 */
export function buildIssueBody(body: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return [
    body.trim(),
    "",
    "---",
    REQUEST_MARKER,
    `DocVaultアプリから送信${origin ? `（${origin}）` : ""}`,
  ].join("\n");
}
