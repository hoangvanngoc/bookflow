import type { NextConfig } from "next";

// Static export: the whole app runs in the browser, so it can be hosted for free
// on GitHub Pages. BASE_PATH is set by the Pages workflow (e.g. "/bookflow").
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
