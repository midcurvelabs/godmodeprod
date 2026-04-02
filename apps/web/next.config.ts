import type { NextConfig } from "next";

// Ensure node is findable by Turbopack subprocesses
if (!process.env.PATH?.includes("/opt/homebrew/bin")) {
  process.env.PATH = `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}`;
}

const nextConfig: NextConfig = {};

export default nextConfig;
