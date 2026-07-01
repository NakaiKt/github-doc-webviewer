import { basename } from "@docvault/core";

export interface TreeFolder {
  name: string;
  path: string;
  folders: TreeFolder[];
  docs: Array<{ name: string; path: string }>;
}

export const TEMPLATES_DIR = "_templates";
export const ASSETS_DIR = "assets";

export function isDocPath(path: string): boolean {
  return path.endsWith(".md") || path.endsWith(".markdown");
}

/** ドキュメントツリーに表示するファイルか（mdのみ、隠しファイル/テンプレートフォルダは除外）。 */
export function isVisibleDoc(path: string): boolean {
  if (!isDocPath(path)) return false;
  if (path.split("/").some((seg) => seg.startsWith("."))) return false;
  if (path === TEMPLATES_DIR || path.startsWith(`${TEMPLATES_DIR}/`)) return false;
  return true;
}

export function buildTree(paths: string[], titleOf?: (path: string) => string): TreeFolder {
  const root: TreeFolder = { name: "", path: "", folders: [], docs: [] };
  const folderMap = new Map<string, TreeFolder>([["", root]]);

  const ensureFolder = (path: string): TreeFolder => {
    const existing = folderMap.get(path);
    if (existing) return existing;
    const parent = ensureFolder(path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
    const folder: TreeFolder = { name: basename(path), path, folders: [], docs: [] };
    parent.folders.push(folder);
    folderMap.set(path, folder);
    return folder;
  };

  for (const p of paths.filter(isVisibleDoc).sort()) {
    const dir = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
    const fallback = basename(p).replace(/\.(md|markdown)$/, "");
    ensureFolder(dir).docs.push({ name: titleOf?.(p) || fallback, path: p });
  }

  const sortFolder = (f: TreeFolder) => {
    f.folders.sort((a, b) => a.name.localeCompare(b.name, "ja"));
    f.docs.sort((a, b) => a.name.localeCompare(b.name, "ja"));
    f.folders.forEach(sortFolder);
  };
  sortFolder(root);
  return root;
}

/** 既存フォルダ一覧（新規ドキュメントの場所選択用）。 */
export function listFolders(paths: string[]): string[] {
  const dirs = new Set<string>([""]);
  for (const p of paths) {
    if (!isVisibleDoc(p)) continue;
    const parts = p.split("/");
    for (let i = 1; i < parts.length; i++) {
      dirs.add(parts.slice(0, i).join("/"));
    }
  }
  return [...dirs].sort();
}
