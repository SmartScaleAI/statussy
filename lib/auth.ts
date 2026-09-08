import { betterAuth } from "better-auth"
import { magicLink } from "better-auth/plugins"
import { nextCookies } from "better-auth/next-js"
import { Resend } from "resend"

import { getDatabasePool } from "@/lib/db"
import { resolveSsl } from "@/lib/live-status"
import { Pool } from "pg"

/**
 * Better Auth (SMA-103). Users/sessions live in the same Railway Postgres
 * as the board (`user`, `session`, `account`, `verification` — see
 * `worker/migrations/0007_better_auth.sql`).
 *
 * Env (never commit values): BETTER_AUTH_SECRET, BETTER_AUTH_URL,
 * RESEND_API_KEY, RESEND_FROM, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
 * GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET.
 */

function authDatabase(): Pool {
  const existing = getDatabasePool()
  if (existing) {
    return existing
  }
  // Build/dev without DATABASE_URL still need a Pool instance. Requests fail
  // until the real URL is set (same graceful pattern as the mock board).
  const databaseUrl = process.env.DATABASE_URL
  return new Pool({
    connectionString: databaseUrl ?? "postgres://127.0.0.1:5432/statussy",
    ssl: databaseUrl ? resolveSsl(databaseUrl) : false,
    max: 1,
    connectionTimeoutMillis: 1_000,
  })
}

function authTrustedOrigins(): string[] {
  const origins = new Set<string>([
    "https://statussy.com",
    "https://www.statussy.com",
  ])
  const base = process.env.BETTER_AUTH_URL
  if (base) {
    origins.add(base.replace(/\/$/, ""))
  }
  const vercel = process.env.VERCEL_URL
  if (vercel) {
    origins.add(`https://${vercel}`)
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
  const from = process.env.RESEND_FROM
  if (!apiKey || !from) {
    throw new Error("Resend is not configured (RESEND_API_KEY / RESEND_FROM)")
  }
  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: "Sign in to Statussy",
    text: `Sign in to Statussy with this link:\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Sign in to Statussy with this link:</p><p><a href="${url}">${url}</a></p><p>If you did not request this, you can ignore this email.</p>`,
  })
  if (error) {
    throw new Error(error.message)
  }
}

export const auth = betterAuth({
  appName: "Statussy",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: authDatabase(),
  trustedOrigins: authTrustedOrigins(),
  emailAndPassword: {
    enabled: false,
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
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"],
    },
  },
  advanced: {
    database: {
      // Worker applies the SQL migration. Skip a boot-time DB round-trip so
      // the board still renders when auth tables are not up yet.
      validateSchema: false,
    },
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
