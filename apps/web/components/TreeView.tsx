"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileText, FolderClosed, FolderOpen, Plus } from "lucide-react";
import { basename, docTitle, joinPath } from "@docvault/core";
import { useStore } from "@/lib/store";
import { buildTree, type TreeFolder } from "@/lib/tree";

/**
 * ドキュメントツリー。任意の階層に新規作成でき、ドラッグ&ドロップでの移動にも対応する
 * （移動先を指定する移動ボタンはDocPage側にある）。
 */
export default function TreeView({ onNewDoc }: { onNewDoc: (dir: string) => void }) {
  const files = useStore((s) => s.files);
  const tree = useMemo(
    () =>
      buildTree(Object.keys(files), (p) => {
        const content = files[p]?.content;
        const fallback = basename(p).replace(/\.(md|markdown)$/, "");
        return content ? docTitle(content, fallback) : fallback;
      }),
    [files]
  );
  const [dragOverRoot, setDragOverRoot] = useState(false);

  const onDropToRoot = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverRoot(false);
    const src = e.dataTransfer.getData("application/x-docvault-path");
    if (src && src.includes("/")) {
      void useStore.getState().moveDoc(src, basename(src));
    }
  };

  return (
    <div
      className={`min-h-full rounded-lg pb-8 ${dragOverRoot ? "bg-blue-50 dark:bg-blue-950/40" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOverRoot(true);
      }}
      onDragLeave={() => setDragOverRoot(false)}
      onDrop={onDropToRoot}
    >
      {tree.folders.map((f) => (
        <FolderNode key={f.path} folder={f} depth={0} onNewDoc={onNewDoc} />
      ))}
      {tree.docs.map((d) => (
        <DocNode key={d.path} name={d.name} path={d.path} depth={0} />
      ))}
      {tree.folders.length === 0 && tree.docs.length === 0 && (
        <p className="px-2 py-2 text-xs text-neutral-400">
          Markdownファイルがありません。「＋」から作成してください。
        </p>
      )}
    </div>
  );
}

function FolderNode({
  folder,
  depth,
  onNewDoc,
}: {
  folder: TreeFolder;
  depth: number;
  onNewDoc: (dir: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const [dragOver, setDragOver] = useState(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const src = e.dataTransfer.getData("application/x-docvault-path");
    if (!src) return;
    const dest = joinPath(folder.path, basename(src));
    if (dest !== src) void useStore.getState().moveDoc(src, dest);
  };

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded px-1 py-1 text-sm hover:bg-neutral-200 dark:hover:bg-neutral-800 ${
          dragOver ? "bg-blue-100 dark:bg-blue-900/50" : ""
        }`}
        style={{ paddingLeft: depth * 12 + 4 }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <button onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center gap-1.5">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
          )}
          {open ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
          ) : (
            <FolderClosed className="h-4 w-4 shrink-0 text-amber-500" />
          )}
          <span className="truncate">{folder.name}</span>
        </button>
        <button
          onClick={() => onNewDoc(folder.path)}
          title={`${folder.name} 内に新規ドキュメント`}
          className="hidden rounded p-0.5 text-neutral-400 group-hover:block hover:bg-neutral-300 dark:hover:bg-neutral-700"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && (
        <div>
          {folder.folders.map((f) => (
            <FolderNode key={f.path} folder={f} depth={depth + 1} onNewDoc={onNewDoc} />
          ))}
          {folder.docs.map((d) => (
            <DocNode key={d.path} name={d.name} path={d.path} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function DocNode({ name, path, depth }: { name: string; path: string; depth: number }) {
  const currentPath = useStore((s) => s.currentPath);
  const openDoc = useStore((s) => s.openDoc);
  const active = currentPath === path;

  return (
    <button
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-docvault-path", path);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => openDoc(path)}
      className={`flex w-full items-center gap-1.5 rounded px-1 py-1 text-left text-sm ${
        active
          ? "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100"
          : "hover:bg-neutral-200 dark:hover:bg-neutral-800"
      }`}
      style={{ paddingLeft: depth * 12 + 22 }}
    >
      <FileText className="h-4 w-4 shrink-0 text-neutral-400" />
      <span className="truncate">{name}</span>
    </button>
  );
}
