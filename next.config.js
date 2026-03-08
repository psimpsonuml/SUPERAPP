/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proxy /api calls to the Express backend in development
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
