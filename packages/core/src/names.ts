/**
 * ドキュメント名の扱い。
 *
 * このアプリでは **「ドキュメント名 = ファイル名（拡張子なし）」を唯一の正** とする。
 * frontmatterの `title` は表示名として使わない:
 * - GitHubのファイルブラウザでもObsidianでも見えるのはファイル名であり、
 *   「このツールをやめても中身がそのまま読める」という設計原則に一致するのはファイル名の方
 * - 2箇所に名前があると必ずズレる（実際、titleを変えても表示が変わらないという混乱が起きる）
 *
 * ただし既存ファイルの `title` を勝手に消しはしない。リネーム時に「旧ファイル名と一致していた」
 * `title` と先頭H1だけを追従させる（= 同期していたものは同期したままにする）。
 */
import { basename, dirname, joinPath } from "./paths";
import { parseDoc, serializeDoc } from "./frontmatter";

const DOC_EXT_RE = /\.(md|markdown)$/i;

/** 拡張子を除いたドキュメントの表示名。 */
export function docName(path: string): string {
  return basename(path).replace(DOC_EXT_RE, "");
}

/** ドキュメントの拡張子（`.md` / `.markdown`）。それ以外は `.md` を返す。 */
export function docExtension(path: string): string {
  const m = basename(path).match(DOC_EXT_RE);
  return m ? m[0] : ".md";
}

/** ファイル名に使えない文字を `-` に置換する（パス区切り・URL/OS予約文字）。 */
export function sanitizeFileName(name: string): string {
  return name
    .trim()
    .replace(/[\\/#?%*:|"<>]/g, "-")
    .replace(/^\.+/, "")
    .trim();
}

/** 同じフォルダ・同じ拡張子のまま、名前だけ差し替えたパスを返す。 */
export function renamedPath(path: string, newName: string): string {
  const safe = sanitizeFileName(newName);
  if (!safe) return path;
  return joinPath(dirname(path), safe + docExtension(path));
}

/**
 * リネームに伴う本文の追従。
 * 旧ファイル名と**完全に一致していた場合に限り** frontmatterの `title` と
 * 本文先頭のH1を新しい名前へ更新する（ユーザーが独自に書き換えた見出しには触らない）。
 */
export function syncDocName(content: string, oldName: string, newName: string): string {
  if (!oldName || !newName || oldName === newName) return content;
  const { frontmatter, body } = parseDoc(content);
  let changed = false;

  const fm = { ...frontmatter };
  if (typeof fm.title === "string" && fm.title.trim() === oldName) {
    fm.title = newName;
    changed = true;
  }

  let nextBody = body;
  const h1 = body.match(/^#[ \t]+(.+?)[ \t]*$/m);
  // コードフェンス内の `# ...` を誤って書き換えないよう、最初のフェンスより前のH1だけを対象にする
  const fenceIdx = body.search(/^[ \t]*(```|~~~)/m);
  if (
    h1 &&
    h1.index != null &&
    (fenceIdx === -1 || h1.index < fenceIdx) &&
    h1[1].trim() === oldName
  ) {
    nextBody = body.slice(0, h1.index) + `# ${newName}` + body.slice(h1.index + h1[0].length);
    changed = true;
  }

  return changed ? serializeDoc(fm, nextBody) : content;
}
