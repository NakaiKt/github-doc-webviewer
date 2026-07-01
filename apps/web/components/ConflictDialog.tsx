"use client";

import { AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/store";

/**
 * push時にリモートが進んでいた場合のシンプルな競合ダイアログ。
 * 3-wayマージは行わず「最新を取得（自分の変更を破棄）」か「このまま上書き」の二択。
 */
export default function ConflictDialog() {
  const conflict = useStore((s) => s.conflict);
  const resolve = useStore((s) => s.resolveConflict);
  if (!conflict) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-neutral-900">
        <div className="mb-3 flex items-center gap-2 text-amber-600">
          <AlertTriangle className="h-5 w-5" />
          <h2 className="text-base font-bold">他の人が更新しています</h2>
        </div>
        <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
          以下のファイルがGitHub上で更新されており、あなたのローカル編集と競合しています。
        </p>
        <ul className="mb-4 max-h-32 overflow-y-auto rounded-lg bg-neutral-50 p-2 text-xs dark:bg-neutral-800">
          {conflict.paths.map((p) => (
            <li key={p} className="truncate py-0.5 font-mono">
              {p}
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => resolve("theirs")}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            最新を取得する（自分の変更を破棄）
          </button>
          <button
            onClick={() => resolve("mine")}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            このまま上書きする
          </button>
        </div>
      </div>
    </div>
  );
}
