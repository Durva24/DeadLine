import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    // You can also tweak formats here if needed
    formats: ['image/avif', 'image/webp'],
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'css-select': require.resolve('css-select'),
    };
    return config;
  },
};
export default nextConfig;