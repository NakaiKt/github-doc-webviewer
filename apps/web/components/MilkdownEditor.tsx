"use client";

import { useEffect, useRef, useState } from "react";
import type { Crepe } from "@milkdown/crepe";
import { EditorView as CodeMirrorView } from "@codemirror/view";
import { dirname, relativeTo, resolveRelative, isRelativeUrl, splitAnchor } from "@docvault/core";
import { useStore } from "@/lib/store";
import { fetchImageUrl } from "@/lib/images";
import { normalizeCrepeMarkdown } from "@/lib/crepeMarkdown";
import { alertDecorationPlugin, buildAlertMenu } from "@/lib/alerts";
import { codeMirrorTheme } from "@/lib/codeTheme";
import { embedLivePlugin, mermaidLivePlugin, relativeLinkPlugin } from "@/lib/liveEditor";
import { renderMermaid } from "@/lib/mermaid";

import "@milkdown/crepe/theme/common/style.css";

/**
 * Milkdown Crepe によるWYSIWYG Markdownエディタ。閲覧モードは持たず、これ1つで完結する
 * （NotionやObsidianのLive Preview相当）。
 * Markdownが実体（remarkベースでパース/シリアライズが対称）なので、
 * 保存されるのは常にプレーンなGFM互換Markdown。
 * GitHub Alertsは「先頭行が `[!NOTE]` の引用ブロック」として編集中も色付きで表示され、
 * `/` やブロックハンドルの ＋ から挿入できる。
 * Mermaidと埋め込み記法はカーソルが入っていない間だけ描画結果に差し替わる（@/lib/liveEditor）。
 */
export default function MilkdownEditor({
  docPath,
  initialValue,
  codeWrap,
  onChange,
}: {
  docPath: string;
  initialValue: string;
  /** コードブロックを折り返す（表示設定）。切り替え時はDocPage側でエディタを作り直す */
  codeWrap: boolean;
  onChange: (markdown: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
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
            // GitHub Alertsをスラッシュメニュー（`/`・ブロックハンドルの ＋）に追加する
            [Crepe.Feature.BlockEdit]: {
              buildMenu: buildAlertMenu,
            },
            [Crepe.Feature.CodeMirror]: {
              // Crepe既定のOne Dark（暗色前提）を、ライト/ダーク両対応の配色に差し替える
              theme: codeMirrorTheme,
              // 折り返し表示（表示設定）。CodeMirror側の実測に関わるのでCSSではなく拡張で行う
              extensions: codeWrap ? [CodeMirrorView.lineWrapping] : [],
              copyText: "コピー",
              // コピーは既存のボタンが行う。ここでは押したことが分かるように通知を出す
              onCopy: () => useStore.getState().setToast("コードをコピーしました"),
              previewLabel: "プレビュー",
              previewLoading: "図を描画中…",
              // mermaid以外は renderPreview が null を返すのでプレビューは付かず、
              // このフラグの影響も受けない（通常のコードブロックのまま）
              previewOnlyByDefault: true,
              renderPreview: (language, content, applyPreview) => {
                if (language?.trim().toLowerCase() !== "mermaid") return null;
                if (!content.trim()) return null;
                renderMermaid(content).then(applyPreview, (e: unknown) => {
                  const message = e instanceof Error ? e.message : String(e);
                  const box = document.createElement("pre");
                  box.className = "dv-mermaid-error";
                  box.textContent = `Mermaid構文エラー: ${message}`;
                  applyPreview(box);
                });
                // 非同期描画。undefinedを返すと描画完了までLoading表示になる
                return undefined;
              },
            },
          },
        });

        // GitHub Alertsの引用ブロックを編集中も色付きで見せる
        instance.editor.use(alertDecorationPlugin);
        // Mermaid・埋め込みのライブ描画と、相対リンクでのアプリ内移動
        instance.editor.use(mermaidLivePlugin);
        instance.editor.use(embedLivePlugin);
        instance.editor.use(relativeLinkPlugin);

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
      if (crepe) void crepe.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallback]);

  if (fallback) {
    return (
      <div>
        <p className="mb-2 text-xs text-amber-600">
          WYSIWYGエディタを初期化できなかったため、プレーンテキスト編集に切り替えました
          {error ? `（${error}）` : ""}
        </p>
        <textarea
          defaultValue={initialValue}
          onChange={(e) => onChangeRef.current(e.target.value)}
          wrap={codeWrap ? "soft" : "off"}
          className="h-[70vh] w-full rounded-lg border border-neutral-200 p-4 font-mono text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      // docvault-editor: Crepeのstyle.cssは動的importで後から読み込まれるため、
      // 同じ詳細度だと勝てない。1段深いスコープを与えて上書きを効かせる（globals.css参照）
      className="docvault-editor min-h-[50vh]"
      onPointerDown={() => (interactedRef.current = true)}
      onKeyDown={() => (interactedRef.current = true)}
      onPaste={() => (interactedRef.current = true)}
      onDrop={() => (interactedRef.current = true)}
    />
  );
}
