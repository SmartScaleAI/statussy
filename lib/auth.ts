import "server-only"

import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { magicLink } from "better-auth/plugins"
import { Pool } from "pg"
import { Resend } from "resend"

import { getDatabasePool } from "@/lib/db"

function authDatabase(): Pool {
  const pool = getDatabasePool()
  if (pool) {
    return pool
  }
  // Build / local without DATABASE_URL: construct so `betterAuth()` can load.
  // Requests that actually sign in still need a real Postgres.
  return new Pool({
    connectionString: "postgres://127.0.0.1:1/unused",
    connectionTimeoutMillis: 1,
    max: 1,
  })
}

function trustedOrigins(): string[] {
  const origins = new Set<string>([
    "https://statussy.com",
    "https://www.statussy.com",
    "http://localhost:3000",
  ])
  const baseUrl = process.env.BETTER_AUTH_URL?.replace(/\/$/, "")
  if (baseUrl) {
    origins.add(baseUrl)
  }
  if (process.env.VERCEL_URL) {
    origins.add(`https://${process.env.VERCEL_URL}`)
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    origins.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  }
  return [...origins]
}

async function sendMagicLinkEmail({
  email,
  url,
}: {
  email: string
  url: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured")
  }
  const from =
    process.env.RESEND_FROM_EMAIL ?? "Statussy <noreply@statussy.com>"
  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: "Sign in to Statussy",
    text: `Sign in to Statussy:\n${url}\n\nThis link expires in 5 minutes.`,
    html: `<p>Sign in to Statussy:</p><p><a href="${url}">Continue</a></p><p>This link expires in 5 minutes.</p>`,
  })
  if (error) {
    throw new Error(error.message)
  }
}

export const auth = betterAuth({
  database: authDatabase(),
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "statussy-unconfigured-better-auth-secret",
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: trustedOrigins(),
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
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"],
    },
  },
  advanced: {
    database: {
      // Schema is applied by the worker migration; skip a live DB probe at
      // import time so Vercel builds and local mock-board runs stay offline.
      validateSchema: false,
    },
    ...(process.env.BETTER_AUTH_URL?.includes("statussy.com")
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: "statussy.com",
          },
        }
      : {}),
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail({ email, url })
      },
    }),
    nextCookies(),
  ],
})

export type Session = typeof auth.$Infer.Session
