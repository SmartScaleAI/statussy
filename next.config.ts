import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // www and apex both hit this app; list both so a Host/Origin mismatch
  // (Vercel + custom domain) cannot abort the Suggest a Provider action
  // with an uncaught 500 (SMA-30).
  experimental: {
    serverActions: {
      allowedOrigins: ["www.statussy.com", "statussy.com"],
    },
  },
}

export default nextConfig
