/** localStorage に保存するクライアント設定（PAT・選択中リポジトリ・テーマ）。 */

const KEY_TOKEN = "docvault.pat";
const KEY_REPO = "docvault.repo";
const KEY_THEME = "docvault.theme";

export function loadToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY_TOKEN);
}

export function saveToken(token: string | null) {
  if (token) localStorage.setItem(KEY_TOKEN, token);
  else localStorage.removeItem(KEY_TOKEN);
}

export function loadRepoSelection(): { owner: string; name: string } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY_REPO);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v && typeof v.owner === "string" && typeof v.name === "string") return v;
  } catch {
    // ignore
  }
  return null;
}

export function saveRepoSelection(repo: { owner: string; name: string } | null) {
  if (repo) localStorage.setItem(KEY_REPO, JSON.stringify(repo));
  else localStorage.removeItem(KEY_REPO);
}

export type Theme = "light" | "dark";

export function loadTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const t = localStorage.getItem(KEY_THEME);
  if (t === "dark" || t === "light") return t;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  localStorage.setItem(KEY_THEME, theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
}
