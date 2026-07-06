import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
  eslint: {
    ignoreDuringBuilds: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
  webpack: config => {
    config.resolve.alias = {
      ...config.resolve.alias,
      // MetaMask SDK's browser bundle probes this React Native-only storage
      // package. The web build does not use it, so keep it out of Vercel/Next.
      "@react-native-async-storage/async-storage": false,
    };
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      {
        module: /ox\/_esm\/tempo\/internal\/virtualMasterPool\.js/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ];
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

if (isIpfs) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = {
    unoptimized: true,
  };
}

module.exports = nextConfig;
