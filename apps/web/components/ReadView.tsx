"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkGemoji from "remark-gemoji";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import { AlertTriangle, Info, Lightbulb, MessageSquareWarning, OctagonAlert } from "lucide-react";
import {
  ALERT_LABELS,
  dirname,
  isRelativeUrl,
  parseSegments,
  resolveRelative,
  splitAnchor,
  type AlertKind,
  type Segment,
} from "@docvault/core";
import { useStore, resolveDocTarget } from "@/lib/store";
import { useImageUrl } from "@/lib/images";
import MermaidDiagram from "./MermaidDiagram";
import EmbedBlock from "./EmbedBlock";

/**
 * 閲覧モード: GFM準拠の完全描画。
 * Alerts / Mermaid / 埋め込み（![[...]]）はセグメント分割で専用コンポーネントに振り分け、
 * それ以外は react-markdown（GFM + 絵文字 + 脚注 + シンタックスハイライト）で描画する。
 */
export default function ReadView({
  path,
  body,
  embedDepth = 0,
}: {
  path: string;
  body: string;
  embedDepth?: number;
}) {
  const segments = useMemo(() => parseSegments(body), [body]);

  return (
    <div className="readview prose prose-neutral dark:prose-invert max-w-none">
      {segments.map((seg, i) => (
        <SegmentView key={i} seg={seg} path={path} embedDepth={embedDepth} />
      ))}
    </div>
  );
}

function SegmentView({
  seg,
  path,
  embedDepth,
}: {
  seg: Segment;
  path: string;
  embedDepth: number;
}) {
  switch (seg.type) {
    case "mermaid":
      return <MermaidDiagram code={seg.code} />;
    case "embed":
      return embedDepth < 3 ? (
        <EmbedBlock target={seg.target} fromPath={path} depth={embedDepth} />
      ) : (
        <p className="text-sm text-neutral-400">（埋め込みが深すぎます: {seg.target}）</p>
      );
    case "alert":
      return <AlertBlock kind={seg.kind} inner={seg.inner} path={path} />;
    case "md":
      return <MarkdownBlock text={seg.text} path={path} />;
  }
}

/** GitHub Alertsのアイコン（ラベルはGitHubの表示に合わせて @docvault/core 側で定義）。 */
const ALERT_ICONS: Record<AlertKind, React.ReactNode> = {
  note: <Info className="h-4 w-4" />,
  tip: <Lightbulb className="h-4 w-4" />,
  important: <MessageSquareWarning className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  caution: <OctagonAlert className="h-4 w-4" />,
};

function AlertBlock({ kind, inner, path }: { kind: AlertKind; inner: string; path: string }) {
  return (
    <div className={`md-alert md-alert-${kind}`}>
      <div className="md-alert-title">
        {ALERT_ICONS[kind]}
        {ALERT_LABELS[kind]}
      </div>
      {inner && <MarkdownBlock text={inner} path={path} />}
    </div>
  );
}

function RepoImage({ src, alt, fromPath }: { src?: string; alt?: string; fromPath: string }) {
  const isInternal = src && isRelativeUrl(src);
  const abs = isInternal ? resolveRelative(dirname(fromPath), splitAnchor(src).path) : null;
  const url = useImageUrl(abs);
  if (!src) return null;
  if (!isInternal) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt ?? ""} />;
  }
  if (!url) {
    return (
      <span className="inline-block rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-400 dark:bg-neutral-800">
        画像を読み込み中… {alt || abs}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt ?? ""} />;
}

export function MarkdownBlock({ text, path }: { text: string; path: string }) {
  const openDoc = useStore((s) => s.openDoc);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkGemoji]}
      rehypePlugins={[[rehypeHighlight, { detect: false }], rehypeSlug]}
      components={{
        a: ({ href, children }) => {
          if (href && isRelativeUrl(href)) {
            return (
              <a
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  const { path: linkPath, anchor } = splitAnchor(href);
                  const files = useStore.getState().files;
                  const target = resolveDocTarget(files, path, linkPath);
                  if (target) {
                    openDoc(target);
                    if (anchor) {
                      setTimeout(() => {
                        document
                          .getElementById(anchor.slice(1))
                          ?.scrollIntoView({ behavior: "smooth" });
                      }, 300);
                    }
                  } else {
                    useStore.getState().setToast(`リンク先が見つかりません: ${href}`);
                  }
                }}
              >
                {children}
              </a>
            );
          }
          if (href?.startsWith("#")) {
            return (
              <a
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {children}
              </a>
            );
          }
          return (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          );
        },
        img: (props) => <RepoImage src={props.src as string} alt={props.alt} fromPath={path} />,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
