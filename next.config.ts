import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/calendar", destination: "/calendario", permanent: true }];
  },
};

export default nextConfig;
