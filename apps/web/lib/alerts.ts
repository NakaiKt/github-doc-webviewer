"use client";

/**
 * 編集モード（Milkdown Crepe）でのGitHub Alerts対応。
 *
 * Alertsの実体は「先頭行が `[!NOTE]` の引用ブロック」というプレーンなMarkdownなので、
 * 独自ノードは追加せず、
 * - 挿入は Crepe のスラッシュメニュー（`/` ・ブロックハンドルの ＋）にグループを足す
 * - 見た目は ProseMirror の Decoration で与える
 * という2点だけで対応する。保存されるMarkdownは今まで通りGitHubがそのまま描画できる形になる。
 */
import { commandsCtx, editorViewCtx } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import { clearTextInCurrentBlockCommand } from "@milkdown/kit/preset/commonmark";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, TextSelection } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { ALERT_KINDS, ALERT_LABELS, matchAlertMarker, type AlertKind } from "@docvault/core";

const alertDecorationKey = new PluginKey("docvault-alert-decoration");

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
 * カーソル位置にAlertを挿入し、本文の空段落へカーソルを置く。
 * マーカーと本文を別段落にしておき、保存時に `normalizeCrepeMarkdown` が
 * GitHubの正準形（`> [!NOTE]` の次行が本文）へ畳む。
 */
function insertAlert(ctx: Ctx, kind: AlertKind) {
  const view = ctx.get(editorViewCtx);
  // スラッシュメニュー経由では `/note` などが入力された状態なので、まず消す
  ctx.get(commandsCtx).call(clearTextInCurrentBlockCommand.key);

  const { state, dispatch } = view;
  const blockquote = state.schema.nodes.blockquote;
  const paragraph = state.schema.nodes.paragraph;
  if (!blockquote || !paragraph) return;

  const markerText = `[!${kind.toUpperCase()}]`;
  const node = blockquote.create(null, [
    paragraph.create(null, state.schema.text(markerText)),
    paragraph.create(null),
  ]);

  const { $from } = state.selection;
  // 空になった現在の段落があればそれを置き換える（`/` を打った行が残らないように）。
  // delete+insertを同じ位置で行い、挿入位置を確定させる（replaceRangeの補正に頼らない）。
  const emptyBlock = $from.depth > 0 && $from.parent.isTextblock && $from.parent.content.size === 0;
  const start = emptyBlock
    ? $from.before($from.depth)
    : $from.depth === 0
      ? $from.pos
      : $from.after(1);
  const tr = emptyBlock
    ? state.tr.delete(start, $from.after($from.depth)).insert(start, node)
    : state.tr.insert(start, node);

  // blockquote(start) > マーカー段落(start+1) > 本文段落 の中身へカーソルを移す
  const bodyStart = start + 1 + (markerText.length + 2) + 1;
  if (bodyStart <= tr.doc.content.size) {
    tr.setSelection(TextSelection.near(tr.doc.resolve(bodyStart)));
  }

  dispatch(tr.scrollIntoView());
  view.focus();
}

/** lucideと同じ図形のSVG文字列（Crepeのメニューは生SVGを受け取る）。 */
const ICON_PATHS: Record<AlertKind, string> = {
  note: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  tip: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  important:
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v2"/><path d="M12 13h.01"/>',
  warning:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  caution:
    '<path d="M12 16h.01"/><path d="M12 8v4"/><path d="M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z"/>',
};

function icon(kind: AlertKind): string {
  // Crepeのメニューは `li svg { fill: ... }` を当てるため、svgの属性ではなく
  // <g> 側で fill/stroke を宣言して継承値に勝たせる（線画アイコンとして描かせる）
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">',
    '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
    ICON_PATHS[kind],
    "</g></svg>",
  ].join("");
}

/**
 * Crepeのスラッシュメニュー（`/` およびブロックハンドルの ＋）に「アラート」グループを足す。
 * ラベルは絞り込み入力の対象なので、`/note` `/警告` どちらでも引けるようにしている。
 */
export function buildAlertMenu(builder: {
  addGroup: (
    key: string,
    label: string
  ) => {
    addItem: (
      key: string,
      item: { label: string; icon: string; onRun?: (ctx: Ctx) => void }
    ) => unknown;
  };
}) {
  // グループ名はCrepe既定の Text / List / Advanced に合わせて英語、
  // 項目ラベルは絞り込み対象なので `/note` `/注意` どちらでも引けるよう併記する
  const group = builder.addGroup("alert", "Alert");
  const labels: Record<AlertKind, string> = {
    note: "Note 補足",
    tip: "Tip ヒント",
    important: "Important 重要",
    warning: "Warning 注意",
    caution: "Caution 警告",
  };
  for (const kind of ALERT_KINDS) {
    group.addItem(kind, {
      label: labels[kind],
      icon: icon(kind),
      onRun: (ctx) => insertAlert(ctx, kind),
    });
  }
}
