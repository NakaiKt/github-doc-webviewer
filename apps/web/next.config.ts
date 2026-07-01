import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // サーバーレス方針: 静的サイトとして書き出し、任意の静的ホスティングに置ける
  output: "export",
  transpilePackages: ["@docvault/core"],
  reactStrictMode: true,
};

export default nextConfig;
