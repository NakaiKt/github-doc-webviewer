"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ExternalLink,
  MoreHorizontal,
  MoveRight,
  Text,
  Trash2,
  WrapText,
} from "lucide-react";
import { basename } from "@docvault/core";
import { useStore } from "@/lib/store";
import { useDisplay } from "@/lib/display";

/**
 * ドキュメント操作メニュー（ツールバーの「⋯」）。
 * GitHubで開く / 移動 / 削除 と、表示設定（折り返し・全幅）をここに集約する。
 */
export default function DocMenu({ path, onMove }: { path: string; onMove: () => void }) {
  const repo = useStore((s) => s.repo);
  const codeWrap = useDisplay((s) => s.codeWrap);
  const fullWidth = useDisplay((s) => s.fullWidth);
  const toggle = useDisplay((s) => s.toggle);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // メニュー外のクリックとEscapeで閉じる
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as globalThis.Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // 同期先と同じブランチのファイルを指す（frontmatterではなくファイルの実体へのリンク）
  const githubUrl = repo
    ? `https://github.com/${repo.owner}/${repo.name}/blob/${repo.defaultBranch}/` +
      path.split("/").map(encodeURIComponent).join("/")
    : null;

  const remove = () => {
    setOpen(false);
    if (window.confirm(`「${basename(path)}」を削除しますか？（GitHub上からも削除されます）`)) {
      void useStore.getState().deleteDoc(path);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        title="メニュー"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center rounded-lg border border-neutral-200 px-2.5 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-64 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        >
          <a
            href={githubUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <ExternalLink className="h-4 w-4 text-neutral-400" />
            GitHubで開く
          </a>
          <button
            onClick={() => {
              setOpen(false);
              onMove();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <MoveRight className="h-4 w-4 text-neutral-400" />
            移動
          </button>
          <button
            onClick={remove}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
          >
            <Trash2 className="h-4 w-4" />
            削除
          </button>

          <div className="my-1 border-t border-neutral-200 dark:border-neutral-800" />
          <p className="px-3 py-1 text-xs font-semibold tracking-wide text-neutral-400 uppercase">
            表示設定
          </p>
          <ToggleItem
            icon={<WrapText className="h-4 w-4 text-neutral-400" />}
            label="コードを折り返す"
            checked={codeWrap}
            onClick={() => toggle("codeWrap")}
          />
          <ToggleItem
            icon={<Text className="h-4 w-4 text-neutral-400" />}
            label="画面幅いっぱいに表示"
            checked={fullWidth}
            onClick={() => toggle("fullWidth")}
          />
        </div>
      )}
    </div>
  );
}

function ToggleItem({
  icon,
  label,
  checked,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
    >
      {icon}
      <span className="flex-1">{label}</span>
      {checked && <Check className="h-4 w-4 text-blue-500" />}
    </button>
  );
}
