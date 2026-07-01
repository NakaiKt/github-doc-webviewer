"use client";

import { useMemo, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, Kanban, Table2 } from "lucide-react";
import { basename, docTitle, parseDoc } from "@docvault/core";
import { useStore } from "@/lib/store";
import { isVisibleDoc, listFolders } from "@/lib/tree";

interface Row {
  path: string;
  title: string;
  props: Record<string, unknown>;
}

/**
 * データベースビュー（Obsidian Bases / Notionデータベース相当）。
 * 選択中リポジトリ内の複数ファイルのYAMLフロントマターを横断集計して
 * テーブル/カンバンを描画する。
 */
export default function DatabaseView() {
  const files = useStore((s) => s.files);
  const openDoc = useStore((s) => s.openDoc);
  const [folder, setFolder] = useState("");
  const [mode, setMode] = useState<"table" | "kanban">("table");
  const [groupBy, setGroupBy] = useState("status");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const folders = useMemo(() => listFolders(Object.keys(files)), [files]);

  const rows: Row[] = useMemo(() => {
    return Object.values(files)
      .filter(
        (f) =>
          f.isMarkdown &&
          f.content != null &&
          isVisibleDoc(f.path) &&
          (folder === "" || f.path.startsWith(`${folder}/`))
      )
      .map((f) => {
        const { frontmatter } = parseDoc(f.content!);
        return {
          path: f.path,
          title: docTitle(f.content!, basename(f.path).replace(/\.md$/, "")),
          props: frontmatter,
        };
      });
  }, [files, folder]);

  // 出現頻度順のプロパティ列（idは共有リンク用の内部情報なので末尾に）
  const columns = useMemo(() => {
    const freq = new Map<string, number>();
    for (const r of rows) {
      for (const k of Object.keys(r.props)) {
        if (k === "title") continue;
        freq.set(k, (freq.get(k) ?? 0) + 1);
      }
    }
    return [...freq.entries()]
      .sort((a, b) => (a[0] === "id" ? 1 : b[0] === "id" ? -1 : b[1] - a[1]))
      .map(([k]) => k)
      .slice(0, 8);
  }, [rows]);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const val = (r: Row) => (sortKey === "__title" ? r.title : (r.props[sortKey] ?? ""));
    return [...rows].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "ja");
      return sortAsc ? cmp : -cmp;
    });
  }, [rows, sortKey, sortAsc]);

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const raw = r.props[groupBy];
      const key = raw == null || raw === "" ? "未設定" : Array.isArray(raw) ? raw.join(", ") : String(raw);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "ja"));
  }, [rows, groupBy]);

  const display = (v: unknown): string =>
    v == null ? "" : Array.isArray(v) ? v.join(", ") : String(v);

  const clickSort = (key: string) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  return (
    <div className="p-8">
      <h1 className="mb-4 text-xl font-bold">データベースビュー</h1>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <select
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-800"
        >
          <option value="">すべてのドキュメント</option>
          {folders
            .filter((f) => f !== "")
            .map((f) => (
              <option key={f} value={f}>
                {f}/
              </option>
            ))}
        </select>

        <div className="flex overflow-hidden rounded-lg border border-neutral-300 dark:border-neutral-700">
          <button
            onClick={() => setMode("table")}
            className={`flex items-center gap-1 px-3 py-1.5 ${mode === "table" ? "bg-blue-600 text-white" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
          >
            <Table2 className="h-4 w-4" /> テーブル
          </button>
          <button
            onClick={() => setMode("kanban")}
            className={`flex items-center gap-1 px-3 py-1.5 ${mode === "kanban" ? "bg-blue-600 text-white" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
          >
            <Kanban className="h-4 w-4" /> カンバン
          </button>
        </div>

        {mode === "kanban" && (
          <label className="flex items-center gap-2">
            グループ化:
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-800"
            >
              {columns
                .filter((c) => c !== "id")
                .map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              {!columns.includes(groupBy) && <option value={groupBy}>{groupBy}</option>}
            </select>
          </label>
        )}

        <span className="text-neutral-400">{rows.length}件</span>
      </div>

      {mode === "table" ? (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
              <tr>
                <Th label="タイトル" active={sortKey === "__title"} asc={sortAsc} onClick={() => clickSort("__title")} />
                {columns.map((c) => (
                  <Th key={c} label={c} active={sortKey === c} asc={sortAsc} onClick={() => clickSort(c)} />
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr
                  key={r.path}
                  onClick={() => openDoc(r.path)}
                  className="cursor-pointer border-t border-neutral-100 hover:bg-blue-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
                >
                  <td className="px-3 py-2 font-medium">{r.title}</td>
                  {columns.map((c) => (
                    <td key={c} className="max-w-56 truncate px-3 py-2 text-neutral-500">
                      {c === "id" ? (
                        <span className="font-mono text-xs">{display(r.props[c])}</span>
                      ) : (
                        display(r.props[c])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="px-3 py-6 text-center text-neutral-400">
                    対象ドキュメントがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {groups.map(([group, items]) => (
            <div
              key={group}
              className="w-64 shrink-0 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-900"
            >
              <p className="mb-2 flex items-center justify-between text-sm font-semibold">
                {group}
                <span className="text-xs font-normal text-neutral-400">{items.length}</span>
              </p>
              <div className="space-y-2">
                {items.map((r) => (
                  <button
                    key={r.path}
                    onClick={() => openDoc(r.path)}
                    className="block w-full rounded-lg border border-neutral-200 bg-white p-3 text-left shadow-sm hover:border-blue-400 dark:border-neutral-700 dark:bg-neutral-800"
                  >
                    <span className="block text-sm font-medium">{r.title}</span>
                    <span className="block truncate text-xs text-neutral-400">{r.path}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {groups.length === 0 && <p className="text-neutral-400">対象ドキュメントがありません</p>}
        </div>
      )}
    </div>
  );
}

function Th({
  label,
  active,
  asc,
  onClick,
}: {
  label: string;
  active: boolean;
  asc: boolean;
  onClick: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className="cursor-pointer px-3 py-2 font-semibold whitespace-nowrap select-none hover:text-blue-600"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (asc ? <ArrowUpAZ className="h-3.5 w-3.5" /> : <ArrowDownAZ className="h-3.5 w-3.5" />)}
      </span>
    </th>
  );
}
