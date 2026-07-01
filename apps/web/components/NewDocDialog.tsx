"use client";

import { useMemo, useState } from "react";
import { basename } from "@docvault/core";
import { useStore } from "@/lib/store";
import { listFolders, TEMPLATES_DIR } from "@/lib/tree";
import Dialog from "./Dialog";

export default function NewDocDialog({
  initialDir,
  onClose,
}: {
  initialDir: string;
  onClose: () => void;
}) {
  const files = useStore((s) => s.files);
  const [title, setTitle] = useState("");
  const [dir, setDir] = useState(initialDir);
  const [customDir, setCustomDir] = useState("");
  const [template, setTemplate] = useState("");
  const [busy, setBusy] = useState(false);

  const folders = useMemo(() => listFolders(Object.keys(files)), [files]);
  const templates = useMemo(
    () => Object.keys(files).filter((p) => p.startsWith(`${TEMPLATES_DIR}/`) && p.endsWith(".md")).sort(),
    [files]
  );

  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    const targetDir = customDir.trim() ? customDir.trim().replace(/^\/+|\/+$/g, "") : dir;
    await useStore.getState().createDoc(targetDir, title, template || null);
    onClose();
  };

  return (
    <Dialog title="新規ドキュメント" onClose={onClose}>
      <label className="mb-1 block text-xs font-medium text-neutral-500">タイトル</label>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="ドキュメント名"
        className="mb-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-800"
      />

      <label className="mb-1 block text-xs font-medium text-neutral-500">場所</label>
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
        placeholder="または新しいフォルダパスを入力（例: projects/2026）"
        className="mb-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-800"
      />

      <label className="mb-1 block text-xs font-medium text-neutral-500">テンプレート</label>
      <select
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        className="mb-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
      >
        <option value="">（テンプレートなし）</option>
        {templates.map((t) => (
          <option key={t} value={t}>
            {basename(t).replace(/\.md$/, "")}
          </option>
        ))}
      </select>

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
          作成
        </button>
      </div>
    </Dialog>
  );
}
