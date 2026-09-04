import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // www and apex both hit this app; list both so a Host/Origin mismatch
  // (Vercel + custom domain) cannot abort the Suggest a Service action
  // with an uncaught 500 (SMA-30).
  experimental: {
    serverActions: {
      allowedOrigins: ["www.statussy.com", "statussy.com"],
    },
  },
  async redirects() {
    return [
      {
        source: "/providers",
        destination: "/services",
        permanent: true,
      },
      {
        source: "/providers/:id",
        destination: "/services/:id",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
