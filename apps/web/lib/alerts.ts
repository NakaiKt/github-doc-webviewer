"use client";

/**
 * 編集モード（Milkdown Crepe）でのGitHub Alerts対応。
 *
 * Alertsの実体は「先頭行が `[!NOTE]` の引用ブロック」というプレーンなMarkdownなので、
 * 独自ノードは追加せず、ProseMirrorのDecorationで見た目だけを与える。
 * こうすると保存されるMarkdownは今まで通りGitHubがそのまま描画できる形のままになる。
 */
import { editorViewCtx } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, TextSelection } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { ALERT_LABELS, matchAlertMarker, type AlertKind } from "@docvault/core";

const alertDecorationKey = new PluginKey("docvault-alert-decoration");

const PLACEHOLDER = "ここに本文を書きます";

/**
 * 段落の「1行目」のテキスト。
 * Markdownでは引用内の連続行が1段落になり、改行はhardbreakノードとして現れるため、
 * 最初の非テキストノードで打ち切ることでマーカー行だけを取り出す。
 */
function firstLineText(paragraph: ProseNode): string {
  let text = "";
  for (let i = 0; i < paragraph.childCount; i++) {
    const child = paragraph.child(i);
    if (!child.isText) break;
    text += child.text ?? "";
  }
  return text;
}

function buildDecorations(doc: ProseNode): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "blockquote") return;
    const paragraph = node.firstChild;
    if (!paragraph) return;
    const line = firstLineText(paragraph);
    const kind = matchAlertMarker(line);
    if (!kind) return;
    // blockquote(pos) > paragraph(pos+1) > インライン内容(pos+2)
    const markerFrom = pos + 2 + line.indexOf("[");
    const markerTo = markerFrom + kind.length + 3; // `[!` + kind + `]`
    decorations.push(
      Decoration.node(pos, pos + node.nodeSize, {
        class: `md-alert-edit md-alert-${kind}`,
        "data-alert-label": ALERT_LABELS[kind],
      }),
      // マーカー自体はMarkdownの実体なので消さず、見出しとして目立たせるだけにする
      Decoration.inline(markerFrom, markerTo, { class: "md-alert-edit-marker" })
    );
  });
  return DecorationSet.create(doc, decorations);
}

/** 引用ブロックがAlertsならクラスを付けるProseMirrorプラグイン。 */
export const alertDecorationPlugin = $prose(
  () =>
    new Plugin({
      key: alertDecorationKey,
      state: {
        init: (_config, state) => buildDecorations(state.doc),
        apply: (tr, prev) => (tr.docChanged ? buildDecorations(tr.doc) : prev),
      },
      props: {
        decorations: (state) => alertDecorationKey.getState(state) as DecorationSet | undefined,
      },
    })
);

/**
 * カーソル位置のブロックの直後にAlertを挿入する。
 * マーカーと本文を別段落にしておき、保存時に `normalizeCrepeMarkdown` が
 * GitHubの正準形（`> [!NOTE]` の次行が本文）へ畳む。
 */
export function insertAlert(ctx: Ctx, kind: AlertKind) {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const blockquote = state.schema.nodes.blockquote;
  const paragraph = state.schema.nodes.paragraph;
  if (!blockquote || !paragraph) return;

  const markerText = `[!${kind.toUpperCase()}]`;
  const node = blockquote.create(null, [
    paragraph.create(null, state.schema.text(markerText)),
    paragraph.create(null, state.schema.text(PLACEHOLDER)),
  ]);

  const { $from } = state.selection;
  const insertPos = $from.depth === 0 ? $from.pos : $from.after(1);
  const tr = state.tr.insert(insertPos, node);

  // 本文のプレースホルダを選択状態にして、そのまま上書き入力できるようにする
  const bodyStart = insertPos + 1 + (markerText.length + 2) + 1;
  const bodyEnd = bodyStart + PLACEHOLDER.length;
  if (bodyEnd <= tr.doc.content.size) {
    tr.setSelection(TextSelection.create(tr.doc, bodyStart, bodyEnd));
  }

  dispatch(tr.scrollIntoView());
  view.focus();
}
