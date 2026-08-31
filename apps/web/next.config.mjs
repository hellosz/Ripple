/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@ripple/ui', '@ripple/contract', '@ripple/api-client'],
  webpack: (config) => {
    // workspace 包源码用 NodeNext 风格的 .js 后缀导入（实际是 .ts），映射回 TS 源文件
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
  async rewrites() {
    const apiBase = process.env.RIPPLE_API_BASE ?? 'http://localhost:8010';
    return [{ source: '/api/:path*', destination: `${apiBase}/api/:path*` }];
  },
};

export default nextConfig;
