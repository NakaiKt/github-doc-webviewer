"use client";

import { useEffect, useRef, useState } from "react";

let seq = 0;

/** ```mermaid コードブロックの描画（GitHub上でも同じソースが図として描画される）。 */
export default function MermaidDiagram({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(`mermaid-${++seq}`);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        const dark = document.documentElement.classList.contains("dark");
        mermaid.initialize({
          startOnLoad: false,
          theme: dark ? "dark" : "default",
          securityLevel: "strict",
        });
        const { svg } = await mermaid.render(idRef.current, code);
        if (alive) setSvg(svg);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [code]);

  if (error) {
    return (
      <pre className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950">
        Mermaid構文エラー: {error}
      </pre>
    );
  }
  if (!svg) {
    return <p className="text-sm text-neutral-400">図を描画中…</p>;
  }
  return <div className="mermaid-diagram my-4" dangerouslySetInnerHTML={{ __html: svg }} />;
}
