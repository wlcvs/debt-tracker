import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Bank statement PDFs (multi-page faturas) can exceed the 1MB default.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
