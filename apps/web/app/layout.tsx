import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocVault — GitHubリポジトリをNotion風に",
  description:
    "GitHubリポジトリを唯一のデータストアとする、サーバーレスのNotion風ドキュメント管理ツール",
};

const themeInit = `
try {
  var t = localStorage.getItem("docvault.theme");
  if (!t) t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  if (t === "dark") document.documentElement.classList.add("dark");
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
