import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  trailingSlash: true,
  async headers() {
    return [{ source: "/api/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] }];
  },
};

export default nextConfig;
