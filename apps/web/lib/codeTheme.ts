"use client";

/**
 * 編集モードのコードブロック（CodeMirror）配色。
 *
 * Crepeの既定は One Dark（暗色前提）で、ライトテーマの背景に載ると本文が
 * `#abb2bf` になりコントラスト比が2:1を切って読めない。
 * ここで置き換えるが、色は直値ではなく **CSSカスタムプロパティ参照** にしておく。
 * こうするとエディタを作り直さなくても、`html.dark` の切り替えだけで
 * ライト/ダークの配色が入れ替わる（変数の定義は globals.css）。
 */
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

const editorTheme = EditorView.theme({
  "&": {
    color: "var(--code-fg)",
    backgroundColor: "transparent",
  },
  ".cm-content": {
    caretColor: "var(--code-fg)",
    fontFamily: "var(--crepe-font-code)",
  },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--code-fg)" },
  // CodeMirrorの基本テーマは選択範囲の色を `&light` / `&dark` 付きの高詳細度セレクタで当ててくる
  // （フォーカス時は `&dark.cm-focused > .cm-scroller > .cm-selectionLayer ...` で #233 の黒）。
  // こちらはCSS変数1本でライト/ダーク両方を賄う方針なので、明示的に上書きする。
  // なお drawSelection が有効なのでネイティブの選択は隠されており、
  // 実際に見えているのはこの `.cm-selectionBackground` だけ。
  ".cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground": {
    background: "var(--code-selection) !important",
  },
  ".cm-content ::selection": { backgroundColor: "var(--code-selection)" },
  ".cm-activeLine": { backgroundColor: "var(--code-active-line)" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--code-gutter)",
    border: "none",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--code-active-line)",
    color: "var(--code-muted)",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "transparent",
    border: "none",
    color: "var(--code-muted)",
  },
  ".cm-selectionMatch": { backgroundColor: "var(--code-selection)" },
  "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
    backgroundColor: "var(--code-selection)",
  },
});

const highlightStyle = HighlightStyle.define([
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: "var(--code-muted)", fontStyle: "italic" },
  {
    tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword, t.self, t.null, t.atom],
    color: "var(--code-keyword)",
  },
  { tag: [t.string, t.special(t.string), t.regexp], color: "var(--code-string)" },
  { tag: [t.number, t.bool, t.integer, t.float], color: "var(--code-number)" },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName))], color: "var(--code-name)" },
  { tag: [t.typeName, t.className, t.namespace, t.standard(t.typeName)], color: "var(--code-type)" },
  { tag: [t.variableName, t.propertyName, t.attributeName, t.tagName], color: "var(--code-var)" },
  { tag: [t.operator, t.punctuation, t.separator, t.bracket, t.derefOperator], color: "var(--code-fg)" },
  { tag: [t.meta, t.processingInstruction, t.annotation], color: "var(--code-muted)" },
  { tag: [t.link, t.url], color: "var(--code-string)", textDecoration: "underline" },
  { tag: t.heading, color: "var(--code-keyword)", fontWeight: "bold" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.invalid, color: "var(--code-invalid)" },
]);

export const codeMirrorTheme: Extension = [editorTheme, syntaxHighlighting(highlightStyle)];
