"use client";

import dynamic from "next/dynamic";

// アプリ全体がlocalStorage/GitHub API依存のためクライアント側でのみ描画する
const App = dynamic(() => import("@/components/App"), { ssr: false });

export default function Page() {
  return <App />;
}
