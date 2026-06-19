import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@cbt/shared'],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
    ],
  },
};

export default nextConfig;
