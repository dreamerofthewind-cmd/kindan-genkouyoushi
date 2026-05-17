/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages用（静的エクスポート不使用・Edge Runtime対応）
  experimental: {
    serverComponentsExternalPackages: ['stripe'],
  },
};

module.exports = nextConfig;
