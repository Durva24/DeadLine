import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
