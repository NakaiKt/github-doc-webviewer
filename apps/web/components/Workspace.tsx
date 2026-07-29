"use client";

import { useEffect, useState } from "react";
import { PanelLeftOpen } from "lucide-react";
import { useStore } from "@/lib/store";
import { loadSidebarCollapsed, saveSidebarCollapsed } from "@/lib/settings";
import Sidebar from "./Sidebar";
import DocPage from "./DocPage";
import DatabaseView from "./DatabaseView";
import ConflictDialog from "./ConflictDialog";

const AUTO_SYNC_MS = 60_000;

export default function Workspace({
  initialRequest,
}: {
  initialRequest: { docId?: string; path?: string };
}) {
  const loadState = useStore((s) => s.loadState);
  const loadError = useStore((s) => s.loadError);
  const view = useStore((s) => s.view);
  const currentPath = useStore((s) => s.currentPath);
  const clearRepo = useStore((s) => s.clearRepo);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // localStorageはSSR時に読めないのでマウント後に反映する
  useEffect(() => setSidebarCollapsed(loadSidebarCollapsed()), []);

  const toggleSidebar = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    saveSidebarCollapsed(collapsed);
  };

  useEffect(() => {
    void useStore.getState().loadRepo(initialRequest);
    // 1分ごとの自動pull/push
    const timer = setInterval(() => {
      const s = useStore.getState();
      if (s.loadState === "ready" && !s.conflict) void s.syncNow();
    }, AUTO_SYNC_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loadState === "error") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="text-red-600">リポジトリの読み込みに失敗しました: {loadError}</p>
        <div className="flex gap-2">
          <button
            onClick={() => useStore.getState().loadRepo(initialRequest)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
          >
            再試行
          </button>
          <button
            onClick={clearRepo}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
          >
            別のリポジトリを選ぶ
          </button>
        </div>
      </div>
    );
  }

  if (loadState !== "ready") {
    return (
      <div className="flex h-screen items-center justify-center text-neutral-500">
        リポジトリを読み込んでいます…
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarCollapsed ? (
        <div className="flex w-10 shrink-0 flex-col items-center border-r border-neutral-200 bg-neutral-50 py-2.5 dark:border-neutral-800 dark:bg-neutral-900">
          <button
            onClick={() => toggleSidebar(false)}
            title="サイドバーを開く"
            className="rounded p-1.5 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <Sidebar onCollapse={() => toggleSidebar(true)} />
      )}
      <main className="min-w-0 flex-1 overflow-y-auto">
        {view.kind === "database" ? (
          <DatabaseView />
        ) : currentPath ? (
          <DocPage key={currentPath} path={currentPath} />
        ) : (
          <EmptyState />
        )}
      </main>
      <ConflictDialog />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-neutral-400">
      <p className="text-lg">ドキュメントを選択するか、新規作成してください</p>
      <p className="text-sm">サイドバーのツリーから開けます</p>
    </div>
  );
}
