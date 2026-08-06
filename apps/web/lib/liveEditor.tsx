"use client";

/**
 * ライブエディタ（編集モード/閲覧モードの切り替えなし）のための表示プラグイン群。
 *
 * Milkdown Crepeは見出し・リスト・表・画像・GitHub Alertsを編集中もそのまま描画するが、
 * Mermaidと埋め込み（`![[...]]`）だけはMarkdownソースのまま残る。ここではその2つを
 * 「カーソルが入っていないときは描画結果、入っているときはソース」に切り替えて、
 * NotionやObsidian（Live Preview）と同じ体験にする。
 *
 * Markdownの実体には一切手を入れない（独自ノードもfrontmatterも増やさない）ので、
 * GitHub上での見え方はこれまでと変わらない。
 */
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, TextSelection, type EditorState } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { isRelativeUrl, splitAnchor } from "@docvault/core";
import { createRoot, type Root } from "react-dom/client";
import { useStore, resolveDocTarget } from "@/lib/store";
import EmbedBlock from "@/components/EmbedBlock";

/** 単独行の埋め込み記法。`packages/core` のセグメント分割と同じ形を見る。 */
const EMBED_LINE_RE = /^!\[\[([^\]\n]+)\]\]$/;

/**
 * ブロックにカーソル（または選択範囲）が掛かっているか。
 * ブロック直前に置いただけのカーソルでソースが開かないよう、範囲の重なりで判定する。
 */
function isTouchedBySelection(state: EditorState, from: number, to: number): boolean {
  return state.selection.from < to && state.selection.to > from;
}

/* ------------------------------------------------------------------ *
 * Mermaid
 * ------------------------------------------------------------------ */

const mermaidKey = new PluginKey("docvault-mermaid-live");

function isMermaidBlock(node: ProseNode): boolean {
  return (
    node.type.name === "code_block" &&
    String(node.attrs.language ?? "").trim().toLowerCase() === "mermaid"
  );
}

function buildMermaidDecorations(state: EditorState): DecorationSet {
  const decorations: Decoration[] = [];
  state.doc.descendants((node, pos) => {
    if (!isMermaidBlock(node)) return;
    const end = pos + node.nodeSize;
    decorations.push(
      Decoration.node(pos, end, {
        class: isTouchedBySelection(state, pos, end) ? "dv-mermaid dv-editing" : "dv-mermaid",
        // 図をクリックしてソースへ入るときの飛び先。Milkdownのコードブロックは
        // nodeViewの stopEvent が常にtrueでProseMirrorにイベントが届かないため、
        // クリック位置からdocの位置を引けるようにDOM属性で持たせておく。
        "data-dv-pos": String(pos),
      })
    );
    return false;
  });
  return DecorationSet.create(state.doc, decorations);
}

/**
 * ```mermaid ブロックの図/ソース切り替え。
 * 図そのものの描画はMilkdownのプレビューパネル（`renderPreview`）が行い、
 * ここでは「どちらを見せるか」のクラス付けと、図クリックでソースへ入る導線だけを担う。
 */
export const mermaidLivePlugin = $prose(
  () =>
    new Plugin({
      key: mermaidKey,
      state: {
        init: (_config, state) => buildMermaidDecorations(state),
        apply: (tr, prev, _old, next) =>
          tr.docChanged || tr.selectionSet ? buildMermaidDecorations(next) : prev,
      },
      props: {
        decorations: (state) => mermaidKey.getState(state) as DecorationSet | undefined,
      },
      view: (view) => {
        const onMouseDown = (event: MouseEvent) => {
          const target = event.target as HTMLElement | null;
          const panel = target?.closest?.(".milkdown-code-block.dv-mermaid .preview-panel");
          if (!panel) return;
          const block = panel.closest(".milkdown-code-block") as HTMLElement | null;
          const pos = Number(block?.dataset.dvPos);
          if (!Number.isInteger(pos) || pos + 1 > view.state.doc.content.size) return;
          event.preventDefault();
          const { state } = view;
          view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(pos + 1))));
          view.focus();
        };
        view.dom.addEventListener("mousedown", onMouseDown);
        return { destroy: () => view.dom.removeEventListener("mousedown", onMouseDown) };
      },
    })
);

/* ------------------------------------------------------------------ *
 * 埋め込みブロック ![[file.md#^block-id]]
 * ------------------------------------------------------------------ */

const embedKey = new PluginKey("docvault-embed-live");

/** 段落全体が埋め込み記法1つだけなら、その埋め込み先を返す。 */
function embedTargetOf(node: ProseNode): string | null {
  if (node.type.name !== "paragraph") return null;
  return node.textContent.trim().match(EMBED_LINE_RE)?.[1] ?? null;
}

// ウィジェットに載せたReactルート。ProseMirrorがウィジェットを破棄したときに解放する。
const embedRoots = new WeakMap<globalThis.Node, Root>();

/**
 * ウィジェットのDOMを作る。
 * ProseMirrorはウィジェットの再描画要否を `toDOM` の同一性で判断するため、
 * この関数はモジュールレベルに固定しておく必要がある
 * （毎回クロージャを作ると1打鍵ごとにReactツリーが作り直される）。
 */
function embedWidgetToDOM(view: EditorView, getPos: () => number | undefined): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "dv-embed-live";

  // 埋め込み記法そのものを直したいときのための導線。
  // ウィジェット内はstopEventでProseMirrorに届かないので、明示的にカーソルを送り込む。
  const toSource = document.createElement("button");
  toSource.type = "button";
  toSource.className = "dv-embed-source-button";
  toSource.title = "埋め込み記法をソースとして編集する";
  toSource.textContent = "ソース";
  toSource.addEventListener("mousedown", (event) => {
    event.preventDefault();
    const pos = getPos();
    if (pos == null || pos + 1 > view.state.doc.content.size) return;
    const { state } = view;
    view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(pos + 1))));
    view.focus();
  });
  wrapper.appendChild(toSource);

  const host = document.createElement("div");
  wrapper.appendChild(host);

  const pos = getPos();
  const node = pos == null ? null : view.state.doc.nodeAt(pos);
  const target = node ? embedTargetOf(node) : null;
  const fromPath = useStore.getState().currentPath;
  if (target && fromPath) {
    const root = createRoot(host);
    root.render(<EmbedBlock target={target} fromPath={fromPath} depth={0} />);
    embedRoots.set(wrapper, root);
  }
  return wrapper;
}

function destroyEmbedWidget(node: globalThis.Node) {
  const root = embedRoots.get(node);
  if (!root) return;
  embedRoots.delete(node);
  // Reactの描画中にunmountすると警告になるので、次のマイクロタスクへ逃がす
  queueMicrotask(() => root.unmount());
}

function buildEmbedDecorations(state: EditorState): DecorationSet {
  const decorations: Decoration[] = [];
  state.doc.descendants((node, pos) => {
    // 段落の中には埋め込みは現れないので降りない。それ以外（引用・リスト等）は降りる
    if (node.type.name === "paragraph" && !embedTargetOf(node)) return false;
    const target = embedTargetOf(node);
    if (!target) return true;
    const end = pos + node.nodeSize;
    // カーソルが入っている間は記法をそのまま見せる（編集・削除できるように）
    if (isTouchedBySelection(state, pos, end)) return false;
    decorations.push(
      Decoration.node(pos, end, { class: "dv-embed-source" }),
      Decoration.widget(pos, embedWidgetToDOM, {
        side: -1,
        key: `dv-embed:${target}`,
        // ウィジェット内のボタン（元ファイルを開く/書き戻し）を素直に動かす
        stopEvent: () => true,
        ignoreSelection: true,
        destroy: destroyEmbedWidget,
      })
    );
    return false;
  });
  return DecorationSet.create(state.doc, decorations);
}

/** `![[...]]` だけの段落を、カーソルが入っていない間は埋め込み内容として描画する。 */
export const embedLivePlugin = $prose(
  () =>
    new Plugin({
      key: embedKey,
      state: {
        init: (_config, state) => buildEmbedDecorations(state),
        apply: (tr, prev, _old, next) =>
          tr.docChanged || tr.selectionSet ? buildEmbedDecorations(next) : prev,
      },
      props: {
        decorations: (state) => embedKey.getState(state) as DecorationSet | undefined,
      },
    })
);

/* ------------------------------------------------------------------ *
 * ドキュメント間リンク
 * ------------------------------------------------------------------ */

/**
 * 本文中の相対リンク（`[名前](../foo.md)`）のクリックでアプリ内を移動する。
 * 閲覧モードを廃止した分、この導線はエディタ側で用意する必要がある。
 * 外部リンクは触らず、ブラウザの既定動作に任せる。
 */
export const relativeLinkPlugin = $prose(
  () =>
    new Plugin({
      key: new PluginKey("docvault-relative-link"),
      props: {
        handleDOMEvents: {
          click: (_view, event) => {
            const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]");
            const href = anchor?.getAttribute("href");
            if (!href || !isRelativeUrl(href)) return false;
            event.preventDefault();
            const { path: linkPath, anchor: hash } = splitAnchor(href);
            const store = useStore.getState();
            const fromPath = store.currentPath;
            const target = fromPath
              ? resolveDocTarget(store.files, fromPath, linkPath)
              : null;
            if (!target) {
              store.setToast(`リンク先が見つかりません: ${href}`);
              return true;
            }
            store.openDoc(target);
            if (hash) {
              setTimeout(() => {
                document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
              }, 300);
            }
            return true;
          },
        },
      },
    })
);
