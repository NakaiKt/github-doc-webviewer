"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import Dialog from "./Dialog";

/**
 * 未参照画像の検出と手動削除。
 * 参照走査は本文のMarkdown画像/リンク・埋め込み・frontmatter内の画像指定を対象とする。
 * いきなり削除せず候補一覧から選択して削除する。
 */
export default function UnusedImagesDialog({ onClose }: { onClose: () => void }) {
  const getUnusedImages = useStore((s) => s.getUnusedImages);
  const deleteFiles = useStore((s) => s.deleteFiles);
  const files = useStore((s) => s.files);
  const unused = useMemo(() => getUnusedImages(), [getUnusedImages, files]);
  const [selected, setSelected] = useState<Set<string>>(new Set(unused));
  const [busy, setBusy] = useState(false);

  const toggle = (p: string) => {
    const next = new Set(selected);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    setSelected(next);
  };

  const remove = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`${selected.size}件の画像を削除します。よろしいですか？`)) return;
    setBusy(true);
    await deleteFiles([...selected]);
    setBusy(false);
    onClose();
  };

  const fmtSize = (n: number) =>
    n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(n / 1024)}KB`;

  return (
    <Dialog title="未参照画像の検出" onClose={onClose} wide>
      {unused.length === 0 ? (
        <p className="py-4 text-sm text-neutral-500">
          どのドキュメントからも参照されていない画像はありません 🎉
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
            以下の画像はどのドキュメント（本文・frontmatter・埋め込み）からも参照されていません。
            削除するものを選択してください。
          </p>
          <div className="mb-4 max-h-72 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
            {unused.map((p) => (
              <label
                key={p}
                className="flex cursor-pointer items-center gap-3 border-b border-neutral-100 px-3 py-2 last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
              >
                <input
                  type="checkbox"
                  checked={selected.has(p)}
                  onChange={() => toggle(p)}
                  className="h-4 w-4"
                />
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{p}</span>
                <span className="shrink-0 text-xs text-neutral-400">
                  {fmtSize(files[p]?.size ?? 0)}
                </span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              キャンセル
            </button>
            <button
              onClick={remove}
              disabled={busy || selected.size === 0}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? "削除中…" : `選択した${selected.size}件を削除`}
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}
