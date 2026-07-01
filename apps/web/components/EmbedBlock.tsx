"use client";

import { useMemo, useState } from "react";
import { CornerUpRight, Pencil } from "lucide-react";
import { basename, findBlock, parseDoc, parseEmbedTarget, replaceBlock, serializeDoc } from "@docvault/core";
import { useStore, resolveDocTarget } from "@/lib/store";
import ReadView from "./ReadView";

/**
 * Obsidian互換の埋め込みブロック ![[file.md#^block-id]]。
 * 実体は1箇所（元ファイル）にあり、ここでは参照表示する。
 * 「編集」でその場で書き換えると、実体である元ファイルの該当ブロックへ書き戻される
 * （Notionの同期ブロックに近い体験。書き戻しはこのアプリ独自機能）。
 */
export default function EmbedBlock({
  target,
  fromPath,
  depth,
}: {
  target: string;
  fromPath: string;
  depth: number;
}) {
  const files = useStore((s) => s.files);
  const openDoc = useStore((s) => s.openDoc);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const { path: rawPath, blockId } = useMemo(() => parseEmbedTarget(target), [target]);
  const sourcePath = useMemo(
    () => resolveDocTarget(files, fromPath, rawPath || fromPath),
    [files, fromPath, rawPath]
  );
  const source = sourcePath ? files[sourcePath] : null;

  if (!sourcePath || !source || source.content == null) {
    return (
      <div className="my-3 rounded-lg border border-dashed border-neutral-300 p-3 text-sm text-neutral-400 dark:border-neutral-700">
        埋め込み先が見つかりません: <code>{target}</code>
      </div>
    );
  }

  const { body } = parseDoc(source.content);
  const block = blockId ? findBlock(body, blockId) : null;

  if (blockId && !block) {
    return (
      <div className="my-3 rounded-lg border border-dashed border-neutral-300 p-3 text-sm text-neutral-400 dark:border-neutral-700">
        ブロック <code>^{blockId}</code> が {sourcePath} に見つかりません
      </div>
    );
  }

  const content = block ? block.text : body;

  const startEdit = () => {
    setDraft(content);
    setEditing(true);
  };

  const save = () => {
    // 書き戻し: 元ファイルの該当ブロックを置換し、通常の保存（デバウンスpush）に乗せる。
    // 元ファイルがリモートで先に更新されていた場合は通常の競合フローで検出される。
    const latest = useStore.getState().files[sourcePath];
    if (!latest || latest.content == null || !blockId) return;
    const parsed = parseDoc(latest.content);
    const newBody = replaceBlock(parsed.body, blockId, draft);
    if (newBody == null) {
      useStore.getState().setToast("書き戻しに失敗しました（ブロックが見つかりません）");
      setEditing(false);
      return;
    }
    useStore.getState().writeBackBlock(sourcePath, serializeDoc(parsed.frontmatter, newBody));
    setEditing(false);
  };

  return (
    <div className="group relative my-3 rounded-lg border border-neutral-200 bg-neutral-50/60 p-4 dark:border-neutral-700 dark:bg-neutral-800/40">
      <div className="absolute top-2 right-2 hidden gap-1 group-hover:flex">
        {blockId && !editing && (
          <button
            onClick={startEdit}
            title="この場で編集して元ファイルに書き戻す"
            className="rounded bg-white p-1 text-neutral-400 shadow-sm hover:text-blue-600 dark:bg-neutral-700"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={() => openDoc(sourcePath)}
          title={`元ファイルを開く: ${sourcePath}`}
          className="rounded bg-white p-1 text-neutral-400 shadow-sm hover:text-blue-600 dark:bg-neutral-700"
        >
          <CornerUpRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mb-1 text-[10px] text-neutral-400">
        {basename(sourcePath)}
        {blockId ? ` › ^${blockId}` : ""} からの埋め込み
      </p>
      {editing ? (
        <div>
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.max(3, draft.split("\n").length + 1)}
            className="w-full rounded border border-blue-300 bg-white p-2 font-mono text-sm outline-none dark:border-blue-800 dark:bg-neutral-900"
          />
          <div className="mt-1 flex justify-end gap-2">
            <button
              onClick={() => setEditing(false)}
              className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              キャンセル
            </button>
            <button
              onClick={save}
              className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
            >
              元ファイルへ書き戻す
            </button>
          </div>
        </div>
      ) : (
        <ReadView path={sourcePath} body={content} embedDepth={depth + 1} />
      )}
    </div>
  );
}
