/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@ripple/ui', '@ripple/contract', '@ripple/api-client'],
  async rewrites() {
    const apiBase = process.env.RIPPLE_API_BASE ?? 'http://localhost:8000';
    return [{ source: '/api/:path*', destination: `${apiBase}/api/:path*` }];
  },
};

export default nextConfig;
