"use client";

import { useEffect, useState } from "react";
import { renderMermaid } from "@/lib/mermaid";

/** ```mermaid コードブロックの描画（GitHub上でも同じソースが図として描画される）。 */
export default function MermaidDiagram({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    renderMermaid(code).then(
      (rendered) => {
        if (alive) setSvg(rendered);
      },
      (e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    );
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
