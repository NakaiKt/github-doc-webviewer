"use client";

import { useState } from "react";
import { BookOpen, KeyRound } from "lucide-react";
import { useStore } from "@/lib/store";

export default function PatSetup({
  bootError,
  sharedLink,
}: {
  bootError: string | null;
  sharedLink: boolean;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(bootError);
  const [busy, setBusy] = useState(false);
  const setToken = useStore((s) => s.setToken);

  const submit = async () => {
    if (!value.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await setToken(value.trim());
    } catch {
      setError("認証に失敗しました。トークンが正しいか、有効期限内か確認してください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4 dark:bg-neutral-950">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-6 flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold">DocVault</h1>
            <p className="text-sm text-neutral-500">
              GitHubリポジトリをNotion風ドキュメントとして閲覧・編集
            </p>
          </div>
        </div>

        {sharedLink && (
          <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-200">
            共有リンクが開かれました。このアプリはサーバーを持たず、あなた自身のGitHubトークン（PAT）で
            リポジトリへアクセスします。閲覧するにはPATを発行して入力してください。
          </div>
        )}

        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
          <li>
            GitHubの{" "}
            <a
              href="https://github.com/settings/personal-access-tokens/new"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline"
            >
              Fine-grained personal access tokens
            </a>{" "}
            を開く
          </li>
          <li>ドキュメント用リポジトリを対象に選択</li>
          <li>
            Repository permissions で <b>Contents: Read and write</b>（Metadata:
            Read-only は自動付与）を設定して発行
          </li>
          <li>発行されたトークンを下に貼り付け</li>
        </ol>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <KeyRound className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-neutral-400" />
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="github_pat_..."
              className="w-full rounded-lg border border-neutral-300 py-2 pr-3 pl-9 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-800"
            />
          </div>
          <button
            onClick={submit}
            disabled={busy || !value.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "確認中…" : "保存"}
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <p className="mt-4 text-xs text-neutral-400">
          トークンはこのブラウザのlocalStorageにのみ保存され、GitHub API以外へは送信されません。
        </p>
      </div>
    </div>
  );
}
