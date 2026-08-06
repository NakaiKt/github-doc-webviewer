"use client";

/**
 * Mermaidのレンダリング。
 * エディタ内のライブ描画（Milkdownのプレビューパネル）と、
 * 埋め込みブロックの閲覧描画（MermaidDiagram）の両方から使う。
 */

let seq = 0;

/** ```mermaid のソースをSVG文字列にする。構文エラーはそのまま例外として投げる。 */
export async function renderMermaid(code: string): Promise<string> {
  const mermaid = (await import("mermaid")).default;
  const dark = document.documentElement.classList.contains("dark");
  mermaid.initialize({
    startOnLoad: false,
    theme: dark ? "dark" : "default",
    securityLevel: "strict",
  });
  const { svg } = await mermaid.render(`mermaid-${++seq}`, code);
  return svg;
}
