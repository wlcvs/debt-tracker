import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server be opened from a phone on the same LAN (e.g. to
  // test mobile UI) — Next.js blocks cross-origin dev requests (HMR, RSC)
  // by default, which silently breaks client-side hydration for any origin
  // not listed here.
  allowedDevOrigins: ["192.168.18.178"],
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
  // @napi-rs/canvas ships prebuilt .node binaries, which can't be bundled at
  // all — it's what provides pdfjs's DOMMatrix/Path2D polyfill on the server.
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
  // ...and because both are external, nothing in the compiled output has a
  // static reference for file tracing to follow to @napi-rs/canvas's
  // platform package. Without this the Vercel function ships without the
  // native binary and every PDF import dies with "Cannot polyfill 'Path2D'"
  // followed by "ReferenceError: DOMMatrix is not defined" — a failure that
  // never reproduces locally, where node_modules is complete. Traced for
  // every route rather than just the dashboard: the statement Server Actions
  // execute on whatever route invoked them, and getting the key wrong is only
  // detectable after a deploy.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/@napi-rs/canvas*/**"],
  },
};

export default nextConfig;
