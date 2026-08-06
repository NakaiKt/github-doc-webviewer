import { basename } from "@docvault/core";

export interface TreeFolder {
  name: string;
  path: string;
  folders: TreeFolder[];
  docs: Array<{ name: string; path: string }>;
}

export const TEMPLATES_DIR = "_templates";
export const ASSETS_DIR = "_assets";

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

function isHiddenDir(dir: string): boolean {
  if (!dir) return true;
  if (dir === TEMPLATES_DIR || dir.startsWith(`${TEMPLATES_DIR}/`)) return true;
  return dir.split("/").some((seg) => seg.startsWith("."));
}

/**
 * ツリー/場所選択に表示するフォルダ集合。
 * 表示対象ドキュメントの祖先ディレクトリに加え、`.gitkeep` だけの空フォルダも含める
 * （Gitは空ディレクトリを保持できないため、フォルダ作成は .gitkeep で表現する）。
 */
export function collectFolders(paths: string[]): string[] {
  const dirs = new Set<string>();
  for (const p of paths) {
    const isKeep = basename(p) === ".gitkeep";
    if (!isVisibleDoc(p) && !isKeep) continue;
    const dir = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
    if (isKeep && isHiddenDir(dir)) continue;
    const parts = dir ? dir.split("/") : [];
    for (let i = 1; i <= parts.length; i++) {
      dirs.add(parts.slice(0, i).join("/"));
    }
  }
  return [...dirs].sort();
}

export function buildTree(paths: string[]): TreeFolder {
  const root: TreeFolder = { name: "", path: "", folders: [], docs: [] };
  const folderMap = new Map<string, TreeFolder>([["", root]]);

  const ensureFolder = (path: string): TreeFolder => {
    if (!path) return root;
    const existing = folderMap.get(path);
    if (existing) return existing;
    const parent = ensureFolder(path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
    const folder: TreeFolder = { name: basename(path), path, folders: [], docs: [] };
    parent.folders.push(folder);
    folderMap.set(path, folder);
    return folder;
  };

  // 空フォルダ（.gitkeepのみ）も含めて先にフォルダ階層を作る
  for (const dir of collectFolders(paths)) ensureFolder(dir);

  for (const p of paths.filter(isVisibleDoc).sort()) {
    const dir = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
    // サイドバーの表示名はファイル名（拡張子なし）を使う
    ensureFolder(dir).docs.push({ name: basename(p).replace(/\.(md|markdown)$/, ""), path: p });
  }

  const sortFolder = (f: TreeFolder) => {
    f.folders.sort((a, b) => a.name.localeCompare(b.name, "ja"));
    f.docs.sort((a, b) => a.name.localeCompare(b.name, "ja"));
    f.folders.forEach(sortFolder);
  };
  sortFolder(root);
  return root;
}

/** 既存フォルダ一覧（新規ドキュメント/移動の場所選択用。空フォルダを含む）。 */
export function listFolders(paths: string[]): string[] {
  return ["", ...collectFolders(paths)];
}
