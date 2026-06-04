/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@framevid/db', '@framevid/queue', '@framevid/types'],
  experimental: {
    serverComponentsExternalPackages: ['bullmq', 'ioredis', 'postgres'],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
