/** @type {import('next').NextConfig} */
const nextConfig = {
  // React Strict Mode
  reactStrictMode: true,
  
  // SWC Minification
  swcMinify: true,
  
  // Environment Variables
  env: {
    CUSTOM_KEY: 'my-value',
  },
  
  // API Configuration
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NODE_ENV === 'production' 
          ? 'https://api.yourdomain.com/:path*'
          : 'http://localhost:3001/:path*'
      },
    ];
  },
  
  // Images Configuration
  images: {
    domains: [
      'images-na.ssl-images-amazon.com',
      'm.media-amazon.com',
      'ssl-product-images.www8-hp.com',
      'localhost',
      '127.0.0.1'
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/webp'],
  },
  
  // Experimental Features
  experimental: {
    appDir: true,
    serverComponentsExternalPackages: ['mongoose'],
  },
  
  // Build Configuration
  distDir: 'build',
  generateEtags: false,
  poweredByHeader: false,
  
  // Compression
  compress: true,
  
  // Security Headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      }
    ];
  },
  
  // Webpack Configuration
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Bundle Analyzer
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
          reportFilename: isServer
            ? '../analyze/server.html'
            : './analyze/client.html',
        })
      );
    }
    
    // Custom webpack configurations
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack']
    });
    
    // Optimize bundle size
    if (!dev && !isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@': path.resolve(__dirname, '.'),
      };
    }
    
    return config;
  },
  
  // TypeScript Configuration
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // ESLint Configuration
  eslint: {
    ignoreDuringBuilds: false,
  },
  
  // Trailing Slash
  trailingSlash: false,
  
  // Output Configuration
  output: 'standalone',
  
  // Performance Optimization
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
};

const path = require('path');

module.exports = nextConfig;