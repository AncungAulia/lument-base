import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["spyglass-parking-postcard.ngrok-free.dev"],
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "wagmi",
      "viem",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-slider",
      "@radix-ui/react-switch",
    ],
  },
};

export default nextConfig;
