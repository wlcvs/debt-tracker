import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Bank statement PDFs (multi-page faturas) can exceed the 1MB default.
      bodySizeLimit: "10mb",
    },
  },
  // pdfjs-dist's Node ("legacy") build resolves its worker script via a
  // relative import at runtime; bundling it breaks that path resolution
  // ("Setting up fake worker failed: Cannot find module '.../pdf.worker.mjs'").
  // Keeping it external makes Node require() it straight from node_modules.
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
