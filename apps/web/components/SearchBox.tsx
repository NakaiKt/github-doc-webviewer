"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useStore } from "@/lib/store";
import { searchDocs, type SearchHit } from "@/lib/search";

/** クライアントサイド全文検索（MiniSearch、pull済みキャッシュから構築） */
export default function SearchBox() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const openDoc = useStore((s) => s.openDoc);

  useEffect(() => {
    setHits(searchDocs(query));
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <Search className="pointer-events-none absolute top-2 left-2.5 h-4 w-4 text-neutral-400" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="検索…"
        className="w-full rounded-lg border border-neutral-300 bg-white py-1.5 pr-3 pl-8 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-800"
      />
      {open && query.trim() && (
        <div className="absolute top-full right-0 left-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
          {hits.length === 0 && (
            <p className="px-3 py-2 text-sm text-neutral-400">見つかりませんでした</p>
          )}
          {hits.map((h) => (
            <button
              key={h.path}
              onClick={() => {
                openDoc(h.path);
                setOpen(false);
                setQuery("");
              }}
              className="block w-full border-b border-neutral-100 px-3 py-2 text-left last:border-0 hover:bg-blue-50 dark:border-neutral-700 dark:hover:bg-neutral-700"
            >
              <span className="block truncate text-sm font-medium">{h.title}</span>
              <span className="block truncate text-xs text-neutral-500">{h.snippet}</span>
              <span className="block truncate text-[10px] text-neutral-400">{h.path}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
