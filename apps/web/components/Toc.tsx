"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseHeadings } from "@docvault/core";

/**
 * 目次。常時は見出し階層を示すダッシュだけの細いレールで、
 * ホバー（またはキーボードフォーカス）すると見出しテキストまで開く。
 *
 * 見出しの並びは本文Markdownから取り、スクロール先は
 * 「描画されたトップレベル見出し要素のN番目」で解決する。
 * ProseMirrorの見出しにはid属性が付かないので、slug生成の一致に頼らずに済む。
 * `parseHeadings` 側もトップレベルの見出しだけを返すので順番が一致する。
 */
const HEADING_SELECTOR = ":scope > :is(h1,h2,h3,h4,h5,h6)";

function headingElements(): HTMLElement[] {
  const root = document.querySelector(".milkdown .ProseMirror");
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(HEADING_SELECTOR));
}

export default function Toc({ body }: { body: string }) {
  const headings = useMemo(() => parseHeadings(body), [body]);
  const [active, setActive] = useState(0);
  const railRef = useRef<HTMLElement>(null);
  // クリック直後はスクロール追従を止める。末尾付近の見出しは
  // スクロールしきってもページ上端に来ないため、追従に任せると選択が戻ってしまう。
  const pinnedRef = useRef<number | null>(null);
  const unpinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // スクロールに追従して現在地を更新する（スクロールするのは <main>）
  useEffect(() => {
    if (headings.length === 0) return;
    const scroller = railRef.current?.closest("main") ?? document.querySelector("main");
    if (!scroller) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (pinnedRef.current != null) return;
      const els = headingElements();
      if (els.length === 0) return;
      const box = scroller.getBoundingClientRect();
      const line = box.top + 96;
      let current = 0;
      els.forEach((el, i) => {
        if (el.getBoundingClientRect().top <= line) current = i;
      });
      // 最下部まで来たら、画面に見えている最後の見出しを現在地とする
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4) {
        for (let i = els.length - 1; i >= 0; i--) {
          if (els[i].getBoundingClientRect().top < box.bottom) {
            current = Math.max(current, i);
            break;
          }
        }
      }
      setActive(current);
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [headings]);

  useEffect(
    () => () => {
      if (unpinTimer.current) clearTimeout(unpinTimer.current);
    },
    []
  );

  if (headings.length === 0) return null;

  const jump = (index: number) => {
    const el = headingElements()[index];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(index);
    pinnedRef.current = index;
    if (unpinTimer.current) clearTimeout(unpinTimer.current);
    unpinTimer.current = setTimeout(() => {
      pinnedRef.current = null;
    }, 800);
  };

  return (
    <nav ref={railRef} className="toc-rail" aria-label="目次">
      <div className="toc-list">
        {headings.map((h, i) => (
          <button
            key={`${i}-${h.text}`}
            type="button"
            className="toc-item"
            data-active={active === i}
            title={h.text}
            onClick={() => jump(i)}
          >
            <span
              className="toc-dash"
              style={{ width: `${Math.max(8, 24 - (h.level - 1) * 3)}px` }}
            />
            <span className="toc-label" style={{ paddingLeft: `${(h.level - 1) * 8}px` }}>
              {h.text}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
