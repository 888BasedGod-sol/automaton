/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Disable ESLint during build (run separately)
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Disable TypeScript errors during build for faster iteration
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_AUTOMATON_API: process.env.AUTOMATON_API_URL || 'http://localhost:8888',
  },

  // Image optimization for external domains
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'marketplace.olas.network' },
      { protocol: 'https', hostname: '**.ipfs.io' },
      { protocol: 'https', hostname: 'ipfs.io' },
      { protocol: 'https', hostname: '**.arweave.net' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60, // 1 hour
  },

  // Compression
  compress: true,

  // Production optimizations
  poweredByHeader: false,

  // Experimental features for performance
  experimental: {
    optimizePackageImports: ['lucide-react', 'viem', 'ethers'],
    // Exclude native modules from serverless bundles
    serverComponentsExternalPackages: ['better-sqlite3'],
  },

  // Webpack optimizations
  webpack: (config, { isServer }) => {
    // Ignore native modules in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
      };
    }
    
    // Ignore problematic optional dependencies
    config.resolve.alias = {
      ...config.resolve.alias,
      'pino-pretty': false,
      '@react-native-async-storage/async-storage': false,
    };
    
    // Mark better-sqlite3 as external to prevent bundling
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('better-sqlite3');
    }
    
    return config;
  },

  // Headers for caching static assets
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=300' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
