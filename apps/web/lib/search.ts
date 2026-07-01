import MiniSearch from "minisearch";

/**
 * クライアントサイド全文検索。pull済みローカルキャッシュからインデックスを構築する。
 * GitHub Code Search APIはレート制限が厳しいため使用しない。
 */

export interface SearchDoc {
  path: string;
  title: string;
  text: string;
}

export interface SearchHit {
  path: string;
  title: string;
  snippet: string;
}

let mini: MiniSearch<SearchDoc> | null = null;
const docMap = new Map<string, SearchDoc>();

function createIndex(): MiniSearch<SearchDoc> {
  return new MiniSearch<SearchDoc>({
    idField: "path",
    fields: ["title", "text"],
    storeFields: ["path", "title"],
    searchOptions: {
      boost: { title: 3 },
      prefix: true,
      fuzzy: 0.1,
      combineWith: "AND",
    },
  });
}

export function rebuildSearchIndex(docs: SearchDoc[]) {
  mini = createIndex();
  docMap.clear();
  for (const d of docs) docMap.set(d.path, d);
  mini.addAll(docs);
}

function makeSnippet(text: string, query: string): string {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const lower = text.toLowerCase();
  let idx = -1;
  for (const t of terms) {
    idx = lower.indexOf(t);
    if (idx !== -1) break;
  }
  if (idx === -1) return text.slice(0, 80);
  const start = Math.max(0, idx - 30);
  return (start > 0 ? "…" : "") + text.slice(start, start + 90).replace(/\n/g, " ") + "…";
}

export function searchDocs(query: string, limit = 20): SearchHit[] {
  if (!mini || !query.trim()) return [];
  return mini
    .search(query)
    .slice(0, limit)
    .map((r) => {
      const doc = docMap.get(r.id as string);
      return {
        path: r.id as string,
        title: (r as unknown as { title: string }).title,
        snippet: doc ? makeSnippet(doc.text, query) : "",
      };
    });
}
