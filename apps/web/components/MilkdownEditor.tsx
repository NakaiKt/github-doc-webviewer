"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Info, Lightbulb, MessageSquareWarning, OctagonAlert } from "lucide-react";
import type { Crepe } from "@milkdown/crepe";
import {
  ALERT_KINDS,
  ALERT_LABELS,
  alertSnippet,
  dirname,
  relativeTo,
  resolveRelative,
  isRelativeUrl,
  splitAnchor,
  type AlertKind,
} from "@docvault/core";
import { useStore } from "@/lib/store";
import { fetchImageUrl } from "@/lib/images";
import { normalizeCrepeMarkdown } from "@/lib/crepeMarkdown";
import { alertDecorationPlugin, insertAlert } from "@/lib/alerts";

import "@milkdown/crepe/theme/common/style.css";

const ALERT_ICONS: Record<AlertKind, React.ReactNode> = {
  note: <Info className="h-3.5 w-3.5" />,
  tip: <Lightbulb className="h-3.5 w-3.5" />,
  important: <MessageSquareWarning className="h-3.5 w-3.5" />,
  warning: <AlertTriangle className="h-3.5 w-3.5" />,
  caution: <OctagonAlert className="h-3.5 w-3.5" />,
};

/**
 * Milkdown Crepe によるWYSIWYG Markdownエディタ。
 * Markdownが実体（remarkベースでパース/シリアライズが対称）なので、
 * 保存されるのは常にプレーンなGFM互換Markdown。
 * GitHub Alertsは「先頭行が `[!NOTE]` の引用ブロック」として編集中も色付きで表示され、
 * Mermaid・埋め込み記法は編集時はコードブロック/テキストとして保たれて閲覧モードで描画される。
 */
export default function MilkdownEditor({
  docPath,
  initialValue,
  onChange,
}: {
  docPath: string;
  initialValue: string;
  onChange: (markdown: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Crepeは初期化直後にも正規化済みMarkdownでmarkdownUpdatedを発火するため、
  // ユーザーが実際に操作するまでは変更を伝播しない（開いただけでdirtyにしない）
  const interactedRef = useRef(false);
  const [fallback, setFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fallback) return;
    let crepe: Crepe | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { Crepe } = await import("@milkdown/crepe");
        if (cancelled || !rootRef.current) return;
        rootRef.current.innerHTML = "";
        const docDir = dirname(docPath);

        const instance = new Crepe({
          root: rootRef.current,
          defaultValue: initialValue,
          features: {
            [Crepe.Feature.Latex]: false,
          },
          featureConfigs: {
            [Crepe.Feature.ImageBlock]: {
              // 貼り付け/選択された画像を assets/ に保存し、相対パスで参照する
              onUpload: async (file: File) => {
                const buf = new Uint8Array(await file.arrayBuffer());
                let bin = "";
                const chunk = 0x8000;
                for (let i = 0; i < buf.length; i += chunk) {
                  bin += String.fromCharCode(...buf.subarray(i, i + chunk));
                }
                const path = useStore.getState().uploadAsset(file.name, btoa(bin));
                return relativeTo(docDir, path);
              },
              // 相対パス画像をPAT経由のblob URLに差し替えて表示する
              proxyDomURL: async (url: string) => {
                if (!url || !isRelativeUrl(url)) return url;
                const { path } = splitAnchor(url);
                const abs = resolveRelative(docDir, path);
                const resolved = await fetchImageUrl(abs);
                return resolved ?? url;
              },
            },
            [Crepe.Feature.Placeholder]: {
              text: "入力を始めましょう。「/」でブロックを挿入できます",
            },
          },
        });

        // GitHub Alertsの引用ブロックを編集中も色付きで見せる
        instance.editor.use(alertDecorationPlugin);

        instance.on((listener) => {
          listener.markdownUpdated((_ctx, markdown, prev) => {
            if (!interactedRef.current) return;
            if (markdown !== prev) {
              onChangeRef.current(normalizeCrepeMarkdown(markdown));
            }
          });
        });

        await instance.create();
        if (cancelled) {
          void instance.destroy();
          return;
        }
        crepe = instance;
        crepeRef.current = instance;
      } catch (e) {
        console.error("Crepe editor failed to load", e);
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setFallback(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      crepeRef.current = null;
      if (crepe) void crepe.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallback]);

  /** Alertsをカーソル位置に挿入する（フォールバック時はtextareaへ直接差し込む）。 */
  const addAlert = (kind: AlertKind) => {
    interactedRef.current = true;
    if (fallback) {
      const el = fallbackRef.current;
      if (!el) return;
      const snippet = `\n${alertSnippet(kind, "")}`;
      const at = el.selectionStart ?? el.value.length;
      el.value = `${el.value.slice(0, at)}${snippet}\n${el.value.slice(at)}`;
      el.selectionStart = el.selectionEnd = at + snippet.length;
      el.focus();
      onChangeRef.current(el.value);
      return;
    }
    crepeRef.current?.editor.action((ctx) => insertAlert(ctx, kind));
  };

  const toolbar = (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-neutral-400">アラート:</span>
      {ALERT_KINDS.map((kind) => (
        <button
          key={kind}
          onClick={() => addAlert(kind)}
          title={`GitHub Alert（${ALERT_LABELS[kind]}）を挿入`}
          className={`md-alert-${kind} flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium`}
          style={{ color: "var(--alert-color)", borderColor: "var(--alert-color)" }}
        >
          {ALERT_ICONS[kind]}
          {ALERT_LABELS[kind]}
        </button>
      ))}
    </div>
  );

  if (fallback) {
    return (
      <div>
        <p className="mb-2 text-xs text-amber-600">
          WYSIWYGエディタを初期化できなかったため、プレーンテキスト編集に切り替えました
          {error ? `（${error}）` : ""}
        </p>
        {toolbar}
        <textarea
          ref={fallbackRef}
          defaultValue={initialValue}
          onChange={(e) => onChangeRef.current(e.target.value)}
          className="h-[70vh] w-full rounded-lg border border-neutral-200 p-4 font-mono text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>
    );
  }

  return (
    <div>
      {toolbar}
      <div
        ref={rootRef}
        className="min-h-[50vh]"
        onPointerDown={() => (interactedRef.current = true)}
        onKeyDown={() => (interactedRef.current = true)}
        onPaste={() => (interactedRef.current = true)}
        onDrop={() => (interactedRef.current = true)}
      />
    </div>
  );
}
