import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["react-pdf", "pdfjs-dist"],
  // Empty turbopack key acknowledges Turbopack (default in Next.js 16 dev).
  // The webpack config below still applies for production builds (next build).
  turbopack: {},
  webpack: (config) => {
    // pdfjs-dist optionally requires canvas for Node.js SSR; alias to false
    // so webpack doesn't try to bundle it for the browser.
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
