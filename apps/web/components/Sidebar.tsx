"use client";

import { useMemo, useState } from "react";
import {
  Database,
  FilePlus2,
  FileText,
  FolderPlus,
  ImageOff,
  LayoutTemplate,
  LogOut,
  Moon,
  Plus,
  RefreshCw,
  Repeat,
  Sun,
} from "lucide-react";
import { basename } from "@docvault/core";
import { useStore } from "@/lib/store";
import { applyTheme, loadTheme, type Theme } from "@/lib/settings";
import { TEMPLATES_DIR } from "@/lib/tree";
import SearchBox from "./SearchBox";
import TreeView from "./TreeView";
import NewDocDialog from "./NewDocDialog";
import UnusedImagesDialog from "./UnusedImagesDialog";

export default function Sidebar() {
  const repo = useStore((s) => s.repo);
  const files = useStore((s) => s.files);
  const syncing = useStore((s) => s.syncing);
  const dirtyCount = useStore((s) => s.dirtyCount);
  const lastSyncAt = useStore((s) => s.lastSyncAt);
  const syncNow = useStore((s) => s.syncNow);
  const clearRepo = useStore((s) => s.clearRepo);
  const clearToken = useStore((s) => s.clearToken);
  const openDoc = useStore((s) => s.openDoc);
  const openDatabase = useStore((s) => s.openDatabase);
  const currentPath = useStore((s) => s.currentPath);

  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [newDocDir, setNewDocDir] = useState("");
  const [unusedOpen, setUnusedOpen] = useState(false);

  const templates = useMemo(
    () =>
      Object.keys(files)
        .filter((p) => p.startsWith(`${TEMPLATES_DIR}/`) && p.endsWith(".md"))
        .sort(),
    [files]
  );

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  const createTemplate = () => {
    const name = window.prompt("テンプレート名を入力してください");
    if (!name?.trim()) return;
    void useStore.getState().createDoc(TEMPLATES_DIR, name.trim());
  };

  const openNewDoc = (dir: string) => {
    setNewDocDir(dir);
    setNewDocOpen(true);
  };

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
      {/* リポジトリ（vault）ヘッダ */}
      <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2.5 dark:border-neutral-800">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{repo?.name}</p>
          <p className="truncate text-xs text-neutral-500">{repo?.owner}</p>
        </div>
        <button
          onClick={clearRepo}
          title="リポジトリを切り替え（vault切り替え）"
          className="rounded p-1.5 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"
        >
          <Repeat className="h-4 w-4" />
        </button>
        <button
          onClick={() => void syncNow()}
          title={
            dirtyCount > 0
              ? `未同期の変更が${dirtyCount}件あります。クリックで今すぐ同期`
              : lastSyncAt
                ? `同期済み（${new Date(lastSyncAt).toLocaleTimeString()}）。クリックで手動同期`
                : "手動同期"
          }
          className="relative rounded p-1.5 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin text-blue-500" : ""}`} />
          {dirtyCount > 0 && !syncing && (
            <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-amber-500" />
          )}
        </button>
      </div>

      {/* 検索 */}
      <div className="px-3 py-2">
        <SearchBox />
      </div>

      {/* ドキュメントツリー */}
      <div className="flex items-center justify-between px-3 pt-1 pb-1">
        <span className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">
          ドキュメント
        </span>
        <div className="flex items-center">
          <button
            onClick={() => {
              const name = window.prompt("作成するフォルダのパス（例: projects/2026）");
              if (name?.trim()) useStore.getState().createFolder(name.trim());
            }}
            title="新規フォルダ"
            className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 dark:hover:bg-neutral-800"
          >
            <FolderPlus className="h-4 w-4" />
          </button>
          <button
            onClick={() => openNewDoc("")}
            title="新規ドキュメント"
            className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 dark:hover:bg-neutral-800"
          >
            <FilePlus2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        <TreeView onNewDoc={openNewDoc} />
      </div>

      {/* データベースビュー */}
      <button
        onClick={openDatabase}
        className="mx-1.5 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        <Database className="h-4 w-4 text-neutral-400" />
        データベースビュー
      </button>

      {/* テンプレート */}
      <div className="border-t border-neutral-200 px-1.5 py-2 dark:border-neutral-800">
        <div className="flex items-center justify-between px-1.5 pb-1">
          <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-neutral-400 uppercase">
            <LayoutTemplate className="h-3.5 w-3.5" /> テンプレート
          </span>
          <button
            onClick={createTemplate}
            title="テンプレートを作成"
            className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 dark:hover:bg-neutral-800"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-28 overflow-y-auto">
          {templates.length === 0 && (
            <p className="px-2 py-1 text-xs text-neutral-400">
              テンプレートはまだありません
            </p>
          )}
          {templates.map((p) => (
            <button
              key={p}
              onClick={() => openDoc(p)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-neutral-200 dark:hover:bg-neutral-800 ${
                currentPath === p ? "bg-neutral-200 dark:bg-neutral-800" : ""
              }`}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
              <span className="truncate">{basename(p).replace(/\.md$/, "")}</span>
            </button>
          ))}
        </div>
      </div>

      {/* フッタ: ツール */}
      <div className="flex items-center gap-1 border-t border-neutral-200 px-2 py-2 dark:border-neutral-800">
        <button
          onClick={() => setUnusedOpen(true)}
          title="未参照画像の検出・削除"
          className="rounded p-1.5 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"
        >
          <ImageOff className="h-4 w-4" />
        </button>
        <button
          onClick={toggleTheme}
          title="ダークモード/ライトモード切り替え"
          className="rounded p-1.5 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <div className="flex-1" />
        <button
          onClick={() => {
            if (window.confirm("PATを削除してログアウトしますか？")) clearToken();
          }}
          title="PATを削除してログアウト"
          className="rounded p-1.5 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      {newDocOpen && (
        <NewDocDialog initialDir={newDocDir} onClose={() => setNewDocOpen(false)} />
      )}
      {unusedOpen && <UnusedImagesDialog onClose={() => setUnusedOpen(false)} />}
    </aside>
  );
}
