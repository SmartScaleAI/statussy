import "server-only"

import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { magicLink } from "better-auth/plugins"
import { Pool } from "pg"
import { Resend } from "resend"

import { getDatabasePool } from "@/lib/db"

function authTrustedOrigins(): string[] {
  const origins = new Set([
    "http://localhost:3000",
    "https://statussy.com",
    "https://www.statussy.com",
  ])
  const baseUrl = process.env.BETTER_AUTH_URL?.trim().replace(/\/$/, "")
  if (baseUrl) {
    origins.add(baseUrl)
  }
  const vercelUrl = process.env.VERCEL_URL?.trim()
  if (vercelUrl) {
    origins.add(`https://${vercelUrl}`)
  }
  return [...origins]
}

function authDatabase(): Pool {
  const pool = getDatabasePool()
  if (pool) {
    return pool
  }
  // Build / typecheck without DATABASE_URL still need a Pool instance.
  // Nothing queries it until an auth request hits a configured environment.
  return new Pool({
    connectionString:
      process.env.DATABASE_URL || "postgresql://127.0.0.1:5432/statussy",
    max: 1,
    connectionTimeoutMillis: 1,
  })
}

async function sendMagicLinkEmail({
  email,
  url,
}: {
  email: string
  url: string
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.RESEND_FROM_EMAIL?.trim()
  if (!apiKey || !from) {
    throw new Error(
      "RESEND_API_KEY and RESEND_FROM_EMAIL are required to send magic links"
    )
  }

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: "Sign in to Statussy",
    html: `<p>Click the link below to sign in to Statussy. It expires in 5 minutes.</p><p><a href="${url}">Sign in to Statussy</a></p>`,
    text: `Sign in to Statussy: ${url}\n\nThis link expires in 5 minutes.`,
  })
  if (error) {
    throw new Error(error.message)
  }
}

export const auth = betterAuth({
  appName: "Statussy",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: authDatabase(),
  trustedOrigins: authTrustedOrigins(),
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"],
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    },
  },
  advanced: {
    database: {
      // Schema is applied via worker migration 0007. Skip live introspection
      // so `next build` does not need a reachable Postgres.
      validateSchema: false,
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: sendMagicLinkEmail,
    }),
    nextCookies(),
  ],
})
