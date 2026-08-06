"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Link2 } from "lucide-react";
import { docName, parseDoc, serializeDoc } from "@docvault/core";
import { useStore } from "@/lib/store";
import { useDisplay } from "@/lib/display";
import DocMenu from "./DocMenu";
import MoveDialog from "./MoveDialog";
import PropertiesPanel from "./PropertiesPanel";
import Toc from "./Toc";

const MilkdownEditor = dynamic(() => import("./MilkdownEditor"), {
  ssr: false,
  loading: () => <p className="py-8 text-sm text-neutral-400">エディタを読み込み中…</p>,
});

export default function DocPage({ path }: { path: string }) {
  const entry = useStore((s) => s.files[path]);
  const repo = useStore((s) => s.repo);
  const setToast = useStore((s) => s.setToast);
  const codeWrap = useDisplay((s) => s.codeWrap);
  const [moveOpen, setMoveOpen] = useState(false);

  // 開いたタイミングで遅延ID採番（スペック通り: 未オープンのファイルにはIDがない）
  useEffect(() => {
    useStore.getState().ensureDocId(path);
  }, [path]);

  const parsed = useMemo(
    () => (entry?.content != null ? parseDoc(entry.content) : null),
    [entry?.content]
  );

  if (!entry || entry.content == null || !parsed) {
    return <p className="p-8 text-neutral-400">ファイルを読み込めませんでした: {path}</p>;
  }

  const docId = typeof parsed.frontmatter.id === "string" ? parsed.frontmatter.id : null;

  const copyShareLink = () => {
    const id = docId ?? useStore.getState().ensureDocId(path);
    if (!id || !repo) {
      setToast("共有リンクを生成できませんでした");
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}?repo=${encodeURIComponent(
      `${repo.owner}/${repo.name}`
    )}&doc=${id}`;
    void navigator.clipboard.writeText(url);
    setToast("共有リンクをコピーしました（ファイルを移動しても有効です）");
  };

  const onBodyChange = (newBody: string) => {
    const latest = useStore.getState().files[path];
    if (!latest || latest.content == null) return;
    const { frontmatter } = parseDoc(latest.content);
    useStore.getState().saveLocal(path, serializeDoc(frontmatter, newBody));
  };

  return (
    <div className="dv-doc mx-auto max-w-4xl px-8 py-6">
      {/* ツールバー */}
      <div className="mb-4 flex items-center gap-1 text-sm">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-neutral-400">{path}</span>
        <button
          onClick={copyShareLink}
          title="共有リンクをコピー（ドキュメントIDに紐づく永続リンク）"
          className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          <Link2 className="h-4 w-4" /> 共有
        </button>
        <DocMenu path={path} onMove={() => setMoveOpen(true)} />
      </div>

      {/* ドキュメント名（= ファイル名）。ここを編集するとリネームされる */}
      <DocNameField path={path} />

      {/* frontmatterプロパティ */}
      <PropertiesPanel path={path} />

      {/* 本文（ライブエディタ。閲覧モードへの切り替えはない）
          折り返し設定はCodeMirrorの実測に関わるので、切り替え時は作り直す */}
      <MilkdownEditor
        key={`${path}:${entry.extRev}:${codeWrap ? "wrap" : "nowrap"}`}
        docPath={path}
        initialValue={parsed.body}
        codeWrap={codeWrap}
        onChange={onBodyChange}
      />

      <Toc body={parsed.body} />

      {moveOpen && <MoveDialog path={path} onClose={() => setMoveOpen(false)} />}
    </div>
  );
}

/**
 * ドキュメント名の編集欄。ドキュメント名はファイル名そのものなので、
 * ここを確定するとファイルがリネームされ、参照リンクも自動で書き換わる。
 */
function DocNameField({ path }: { path: string }) {
  const name = docName(path);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 別ドキュメントを開いた / 他の経路でリネームされたときに追従する
  useEffect(() => {
    setValue(name);
  }, [name]);

  const commit = async () => {
    const next = value.trim();
    if (busy || next === name) return;
    if (!next) {
      setValue(name);
      return;
    }
    setBusy(true);
    const ok = await useStore.getState().renameDoc(path, next);
    setBusy(false);
    if (!ok) setValue(name);
  };

  return (
    <input
      ref={inputRef}
      value={value}
      disabled={busy}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          inputRef.current?.blur();
        } else if (e.key === "Escape") {
          setValue(name);
          inputRef.current?.blur();
        }
      }}
      title="ドキュメント名（ファイル名）。変更するとファイルがリネームされ、参照リンクも自動更新されます"
      placeholder="ドキュメント名"
      className="mb-3 w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-3xl font-bold outline-none hover:border-neutral-200 focus:border-blue-500 disabled:opacity-50 dark:hover:border-neutral-700"
    />
  );
}
