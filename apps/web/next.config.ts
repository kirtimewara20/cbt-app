import type { NextConfig } from 'next';
import path from 'path';

// VERCEL is set automatically on Vercel builds — avoid defaulting rewrites to localhost in production.
const apiProxyTarget =
  process.env.API_PROXY_URL ||
  (process.env.VERCEL ? 'https://cbt-api-ktkr.onrender.com' : 'http://localhost:4000');

const nextConfig: NextConfig = {
  transpilePackages: ['@cbt/shared'],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  outputFileTracingRoot: path.join(__dirname, '../..'),
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiProxyTarget}/api/v1/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
    ],
  },
};

export default nextConfig;
