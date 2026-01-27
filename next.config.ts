import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 在开发模式下允许来自这些 origin 的 forwarded Server Actions 请求
  experimental: {
    // Next 的类型目前可能未声明 `allowedDevOrigins`，在此处忽略类型检查以便在开发环境中启用该功能
    // @ts-ignore
    allowedDevOrigins: [
      "http://invite.sstfreya.top",
      "http://invite.sstfreya.top:80",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ],
  },
};

export default nextConfig;
