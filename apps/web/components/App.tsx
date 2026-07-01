"use client";

import { useEffect, useState } from "react";
import { GitHubClient } from "@docvault/core";
import { loadRepoSelection, loadToken } from "@/lib/settings";
import { useStore } from "@/lib/store";
import PatSetup from "./PatSetup";
import RepoPicker from "./RepoPicker";
import Workspace from "./Workspace";
import Toast from "./Toast";

type Stage = "boot" | "pat" | "repo" | "workspace";

/** URLクエリ（共有リンク）で要求されたリポジトリ/ドキュメント */
export interface UrlRequest {
  repo: { owner: string; name: string } | null;
  docId: string | null;
  path: string | null;
}

function readUrlRequest(): UrlRequest {
  const params = new URLSearchParams(window.location.search);
  const repoParam = params.get("repo");
  let repo: UrlRequest["repo"] = null;
  if (repoParam && repoParam.includes("/")) {
    const [owner, ...rest] = repoParam.split("/");
    repo = { owner, name: rest.join("/") };
  }
  return { repo, docId: params.get("doc"), path: params.get("path") };
}

export default function App() {
  const [stage, setStage] = useState<Stage>("boot");
  const [urlRequest, setUrlRequest] = useState<UrlRequest | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const token = useStore((s) => s.token);
  const repo = useStore((s) => s.repo);

  // 起動フロー: PAT確認 → リポジトリ選択 → ワークスペース
  useEffect(() => {
    const request = readUrlRequest();
    setUrlRequest(request);
    const saved = loadToken();
    if (!saved) {
      setStage("pat");
      return;
    }
    (async () => {
      try {
        await useStore.getState().setToken(saved);
      } catch (e) {
        setBootError(
          "保存されたPATでの認証に失敗しました。PATの有効期限・権限を確認してください。"
        );
        setStage("pat");
        return;
      }
      // 共有リンクのrepo指定は保存済み選択より優先する
      const target = request.repo ?? loadRepoSelection();
      if (target) {
        try {
          const client = new GitHubClient(saved);
          const info = await client.getRepo(target.owner, target.name);
          useStore.getState().selectRepo(info);
          setStage("workspace");
          return;
        } catch {
          setBootError(`リポジトリ ${target.owner}/${target.name} を開けませんでした。`);
        }
      }
      setStage("repo");
    })();
  }, []);

  // PAT入力完了後の遷移
  useEffect(() => {
    if (stage === "pat" && token) {
      const target = urlRequest?.repo ?? loadRepoSelection();
      if (target) {
        (async () => {
          try {
            const info = await new GitHubClient(useStore.getState().token!).getRepo(
              target.owner,
              target.name
            );
            useStore.getState().selectRepo(info);
            setStage("workspace");
          } catch {
            setStage("repo");
          }
        })();
      } else {
        setStage("repo");
      }
    }
  }, [token, stage, urlRequest]);

  useEffect(() => {
    if (stage === "repo" && repo) setStage("workspace");
    if (stage === "workspace" && !repo) setStage("repo");
    if (stage === "workspace" && !token) setStage("pat");
  }, [stage, repo, token]);

  if (stage === "boot") {
    return (
      <div className="flex h-screen items-center justify-center text-neutral-500">
        読み込み中…
      </div>
    );
  }

  return (
    <>
      {stage === "pat" && <PatSetup bootError={bootError} sharedLink={Boolean(urlRequest?.repo)} />}
      {stage === "repo" && <RepoPicker />}
      {stage === "workspace" && repo && (
        <Workspace
          key={`${repo.owner}/${repo.name}`}
          initialRequest={{
            docId: urlRequest?.docId ?? undefined,
            path: urlRequest?.path ?? undefined,
          }}
        />
      )}
      <Toast />
    </>
  );
}
