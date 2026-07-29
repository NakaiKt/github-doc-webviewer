"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { parseDoc, serializeDoc } from "@docvault/core";
import { useStore } from "@/lib/store";

/** frontmatterをNotionのプロパティ風に表示・編集するパネル。 */
export default function PropertiesPanel({ path }: { path: string }) {
  const entry = useStore((s) => s.files[path]);
  const [open, setOpen] = useState(true);

  const parsed = useMemo(
    () => (entry?.content != null ? parseDoc(entry.content) : null),
    [entry?.content]
  );
  if (!parsed) return null;

  const keys = Object.keys(parsed.frontmatter);

  const update = (mutate: (fm: Record<string, unknown>) => void) => {
    const latest = useStore.getState().files[path];
    if (!latest || latest.content == null) return;
    const { frontmatter, body } = parseDoc(latest.content);
    const fm = { ...frontmatter };
    mutate(fm);
    useStore.getState().saveLocal(path, serializeDoc(fm, body));
  };

  const setValue = (key: string, raw: string) => {
    update((fm) => {
      // 数値/真偽値/カンマ区切り配列を素朴に推定する
      const trimmed = raw.trim();
      if (trimmed === "true" || trimmed === "false") fm[key] = trimmed === "true";
      else if (trimmed !== "" && !Number.isNaN(Number(trimmed)) && !/^0[0-9]/.test(trimmed))
        fm[key] = Number(trimmed);
      else if (trimmed.includes(",")) fm[key] = trimmed.split(",").map((s) => s.trim());
      else fm[key] = raw;
    });
  };

  const addKey = () => {
    const key = window.prompt("プロパティ名を入力してください（例: status, tags, cover）");
    if (!key?.trim()) return;
    update((fm) => {
      if (!(key.trim() in fm)) fm[key.trim()] = "";
    });
  };

  const removeKey = (key: string) => {
    update((fm) => {
      delete fm[key];
    });
  };

  const display = (v: unknown): string => {
    if (Array.isArray(v)) return v.join(", ");
    if (v == null) return "";
    return String(v);
  };

  return (
    <div className="mb-6 rounded-lg border border-neutral-200 dark:border-neutral-800">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1 px-3 py-2 text-xs font-semibold text-neutral-400 uppercase"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        プロパティ
      </button>
      {open && (
        <div className="px-3 pb-2">
          {keys.length === 0 && (
            <p className="pb-1 text-xs text-neutral-400">プロパティはありません</p>
          )}
          {keys.includes("title") && (
            <p className="mb-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              ドキュメント名はファイル名です。ここの <code>title</code> は表示に使われません
              （名前を変えるには上のタイトル欄を編集してください）。
            </p>
          )}
          {keys.map((key) => (
            <div key={key} className="group flex items-center gap-2 py-0.5">
              <span className="w-28 shrink-0 truncate text-sm text-neutral-500">{key}</span>
              {key === "id" ? (
                <span className="flex-1 truncate font-mono text-xs text-neutral-400">
                  {display(parsed.frontmatter[key])}（共有リンク用ID）
                </span>
              ) : (
                <input
                  defaultValue={display(parsed.frontmatter[key])}
                  onBlur={(e) => {
                    if (e.target.value !== display(parsed.frontmatter[key]))
                      setValue(key, e.target.value);
                  }}
                  className="flex-1 rounded border border-transparent bg-transparent px-1.5 py-0.5 text-sm outline-none hover:border-neutral-200 focus:border-blue-500 dark:hover:border-neutral-700"
                />
              )}
              {key !== "id" && (
                <button
                  onClick={() => removeKey(key)}
                  className="hidden rounded p-1 text-neutral-300 group-hover:block hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addKey}
            className="mt-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Plus className="h-3 w-3" /> プロパティを追加
          </button>
        </div>
      )}
    </div>
  );
}
