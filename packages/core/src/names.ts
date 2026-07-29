/**
 * ドキュメント名の扱い。
 *
 * このアプリでは **「ドキュメント名 = ファイル名（拡張子なし）」を唯一の正** とする。
 * frontmatterに名前は持たせない:
 * - GitHubのファイルブラウザでもObsidianでも見えるのはファイル名であり、
 *   「このツールをやめても中身がそのまま読める」という設計原則に一致するのはファイル名の方
 * - 2箇所に名前があると必ずズレる（titleを変えても表示が変わらないという混乱が起きる）
 */
import { basename, dirname, joinPath } from "./paths";

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
