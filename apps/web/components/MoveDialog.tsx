"use client";

import { useMemo, useState } from "react";
import { basename, dirname } from "@docvault/core";
import { useStore } from "@/lib/store";
import { listFolders } from "@/lib/tree";
import Dialog from "./Dialog";

/**
 * 移動先を指定する移動ボタンのダイアログ。
 * 移動時は本文の相対リンク・画像パスと、参照元ファイルのリンクが自動で書き換わる。
 */
export default function MoveDialog({ path, onClose }: { path: string; onClose: () => void }) {
  const files = useStore((s) => s.files);
  const [dir, setDir] = useState(dirname(path));
  const [customDir, setCustomDir] = useState("");
  const [name, setName] = useState(basename(path));
  const [busy, setBusy] = useState(false);
  const folders = useMemo(() => listFolders(Object.keys(files)), [files]);

  const submit = async () => {
    if (busy) return;
    const fileName = name.trim().endsWith(".md") ? name.trim() : `${name.trim()}.md`;
    const targetDir = customDir.trim() ? customDir.trim().replace(/^\/+|\/+$/g, "") : dir;
    const newPath = targetDir ? `${targetDir}/${fileName}` : fileName;
    setBusy(true);
    const ok = await useStore.getState().moveDoc(path, newPath);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Dialog title="ドキュメントを移動" onClose={onClose}>
      <p className="mb-3 truncate rounded bg-neutral-100 px-2 py-1 font-mono text-xs text-neutral-500 dark:bg-neutral-800">
        {path}
      </p>

      <label className="mb-1 block text-xs font-medium text-neutral-500">移動先フォルダ</label>
      <select
        value={dir}
        onChange={(e) => setDir(e.target.value)}
        className="mb-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
      >
        {folders.map((f) => (
          <option key={f} value={f}>
            {f === "" ? "（ルート）" : f}
          </option>
        ))}
      </select>
      <input
        value={customDir}
        onChange={(e) => setCustomDir(e.target.value)}
        placeholder="または新しいフォルダパスを入力"
        className="mb-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-800"
      />

      <label className="mb-1 block text-xs font-medium text-neutral-500">
        ファイル名（変更でリネーム）
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        className="mb-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-800"
      />

      <p className="mb-4 text-xs text-neutral-500">
        このファイルを参照している全ドキュメントの相対リンクと、本文中の画像への相対パスは
        自動で書き換えられます。
      </p>

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          キャンセル
        </button>
        <button
          onClick={submit}
          disabled={busy || !name.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "移動中…" : "移動"}
        </button>
      </div>
    </Dialog>
  );
}
