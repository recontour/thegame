import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin Turbopack to this app so a stray lockfile in a parent dir
  // (e.g. C:\Users\acer\package-lock.json) is not treated as the root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
