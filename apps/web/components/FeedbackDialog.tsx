"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { GitHubApiError } from "@docvault/core";
import { useStore } from "@/lib/store";
import { buildIssueBody, FEEDBACK_REPO, TITLE_LIMIT } from "@/lib/feedback";
import Dialog from "./Dialog";

/** 成功表示を出してからダイアログを自動で閉じるまでの時間。 */
const AUTO_CLOSE_MS = 5000;

export default function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const client = useStore((s) => s.client);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [issueNumber, setIssueNumber] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 成功時のみ自動で閉じる。失敗時は開いたままにして、利用者が読んで再送できるようにする。
  useEffect(() => {
    if (issueNumber == null) return;
    const timer = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [issueNumber, onClose]);

  const submit = async () => {
    if (!title.trim() || busy || !client) return;
    setBusy(true);
    setError(null);
    try {
      const issue = await client.createIssue(FEEDBACK_REPO, title.trim(), buildIssueBody(body));
      setIssueNumber(issue.number);
    } catch (e) {
      const status = e instanceof GitHubApiError ? e.status : 0;
      // 403/404 はトークン側の事情なので、待っても解決しない。再送を促すのは他の失敗のときだけ。
      setError(
        status === 403 || status === 404
          ? "このトークンからは送信できませんでした。PATを再発行してから、もう一度お試しください。"
          : "送信に失敗しました。時間を置いて、もう一度お試しください。"
      );
    } finally {
      setBusy(false);
    }
  };

  if (issueNumber != null) {
    return (
      <Dialog title="送信しました" onClose={onClose}>
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          <div className="text-sm">
            <p className="text-neutral-700 dark:text-neutral-300">
              要望を受け付けました（#{issueNumber}）。ありがとうございます。
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              このダイアログは自動で閉じます。
            </p>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog title="要望・不具合を送る" onClose={onClose}>
      <label className="mb-1 block text-xs font-medium text-neutral-500">タイトル</label>
      <input
        autoFocus
        value={title}
        maxLength={TITLE_LIMIT}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="ひとことで言うと？"
        className="mb-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-800"
      />

      <label className="mb-1 block text-xs font-medium text-neutral-500">本文</label>
      <textarea
        value={body}
        rows={8}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
        }}
        placeholder="困っていること、こうなったら嬉しいこと、再現手順など。Markdownが使えます。"
        className="mb-3 w-full resize-y rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-800"
      />

      <p className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        送信すると、開発リポジトリ（{FEEDBACK_REPO.owner}/{FEEDBACK_REPO.name}）に
        <strong className="font-semibold">公開のIssue</strong>として投稿されます。
        投稿者としてあなたのGitHubアカウント名が表示されます。
      </p>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          キャンセル
        </button>
        <button
          onClick={submit}
          disabled={!title.trim() || busy}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "送信中…" : "送信"}
        </button>
      </div>
    </Dialog>
  );
}
