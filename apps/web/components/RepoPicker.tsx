"use client";

import { useEffect, useState } from "react";
import { FolderGit2, Lock, LogOut, Search } from "lucide-react";
import type { RepoInfo } from "@docvault/core";
import { useStore } from "@/lib/store";

/** Obsidianのvault選択に相当。同時に開くのは常に1リポジトリ。 */
export default function RepoPicker() {
  const client = useStore((s) => s.client);
  const user = useStore((s) => s.user);
  const selectRepo = useStore((s) => s.selectRepo);
  const clearToken = useStore((s) => s.clearToken);
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [filter, setFilter] = useState("");
  const [manual, setManual] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    (async () => {
      try {
        const pages = await Promise.all([1, 2, 3].map((p) => client.listRepos(p, 100)));
        setRepos(pages.flat());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [client]);

  const openManual = async () => {
    if (!client || !manual.includes("/")) return;
    const [owner, ...rest] = manual.trim().split("/");
    try {
      selectRepo(await client.getRepo(owner, rest.join("/")));
    } catch {
      setError(`${manual} を開けませんでした`);
    }
  };

  const visible = repos.filter((r) =>
    r.fullName.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4 dark:bg-neutral-950">
      <div className="flex max-h-[80vh] w-full max-w-xl flex-col rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">ドキュメントリポジトリを選択</h1>
            <p className="text-sm text-neutral-500">
              {user?.login} としてログイン中。1つのリポジトリがObsidianのvaultに相当します。
            </p>
          </div>
          <button
            onClick={clearToken}
            title="PATを削除してログアウト"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <LogOut className="h-3.5 w-3.5" /> ログアウト
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-neutral-400" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="リポジトリを検索…"
            className="w-full rounded-lg border border-neutral-300 py-2 pr-3 pl-9 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-800"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          {loading && <p className="p-4 text-sm text-neutral-500">読み込み中…</p>}
          {!loading && visible.length === 0 && (
            <p className="p-4 text-sm text-neutral-500">リポジトリが見つかりません</p>
          )}
          {visible.map((r) => (
            <button
              key={r.fullName}
              onClick={() => selectRepo(r)}
              className="flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-2.5 text-left hover:bg-blue-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
            >
              <FolderGit2 className="h-4 w-4 shrink-0 text-neutral-400" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {r.fullName}
                  {r.private && <Lock className="ml-1 inline h-3 w-3 text-neutral-400" />}
                </span>
                {r.description && (
                  <span className="block truncate text-xs text-neutral-500">{r.description}</span>
                )}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && openManual()}
            placeholder="owner/repo を直接入力"
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-800"
          />
          <button
            onClick={openManual}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            開く
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
