import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  logging: {
    browserToTerminal: true,
  },
};

export default nextConfig;
