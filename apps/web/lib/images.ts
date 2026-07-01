import { useEffect, useState } from "react";
import { extname } from "@docvault/core";
import { useStore } from "./store";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
};

// blob sha → objectURL のキャッシュ（sha が変われば取り直す）
const urlCache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

/**
 * リポジトリ内画像の表示用URLを取得する。
 * 未pushのローカル画像は data URL、push済みは Git Data API の blob から objectURL を作る
 * （プライベートリポジトリでも PAT だけで表示できる）。
 */
export async function fetchImageUrl(path: string): Promise<string | null> {
  const { files, client, repo } = useStore.getState();
  const entry = files[path];
  if (!entry) return null;
  const mime = MIME[extname(path)] ?? "application/octet-stream";
  if (entry.binaryBase64) {
    return `data:${mime};base64,${entry.binaryBase64}`;
  }
  if (!entry.sha || !client || !repo) return null;
  const key = `${path}@${entry.sha}`;
  const cached = urlCache.get(key);
  if (cached) return cached;
  const inflight = pending.get(key);
  if (inflight) return inflight;
  const promise = (async () => {
    try {
      const b64 = await client.getBlobBase64({ owner: repo.owner, name: repo.name }, entry.sha!);
      const bin = atob(b64.replace(/\s/g, ""));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
      urlCache.set(key, url);
      return url;
    } catch {
      return null;
    } finally {
      pending.delete(key);
    }
  })();
  pending.set(key, promise);
  return promise;
}

export function useImageUrl(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const entry = useStore((s) => (path ? s.files[path] : null));
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (path && entry) {
      void fetchImageUrl(path).then((u) => {
        if (alive) setUrl(u);
      });
    }
    return () => {
      alive = false;
    };
  }, [path, entry?.sha, entry?.binaryBase64]); // eslint-disable-line react-hooks/exhaustive-deps
  return url;
}
