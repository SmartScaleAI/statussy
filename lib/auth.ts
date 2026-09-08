import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { magicLink } from "better-auth/plugins"
import { Pool } from "pg"
import { Resend } from "resend"

import { getDatabasePool } from "@/lib/db"
import { resolveSsl } from "@/lib/live-status"

const CONNECT_TIMEOUT_MS = 5_000
const QUERY_TIMEOUT_MS = 8_000

/**
 * Reuse the board/suggestion pool when `DATABASE_URL` is set. Build and
 * typecheck can import this module without a live database — Better Auth
 * does not query until a request hits `/api/auth/*`.
 */
function getAuthPool(): Pool {
  const existing = getDatabasePool()
  if (existing) {
    return existing
  }
  const databaseUrl = process.env.DATABASE_URL
  return new Pool({
    connectionString: databaseUrl ?? "postgres://127.0.0.1:5432/statussy",
    max: 1,
    ssl: databaseUrl ? resolveSsl(databaseUrl) : false,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
  })
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
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
    throw new Error("Email sign-in is not configured.")
  }
  const from =
    process.env.RESEND_FROM ?? "Statussy <onboarding@resend.dev>"
  const resend = new Resend(apiKey)
  const safeUrl = escapeHtml(url)
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: "Sign in to Statussy",
    html: `<p>Click <a href="${safeUrl}">this link</a> to sign in to Statussy.</p><p>If you did not request this, you can ignore this email.</p>`,
  })
  if (error) {
    throw new Error(error.message)
  }
}

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
const githubClientId = process.env.GITHUB_CLIENT_ID
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET

const trustedOrigins = [
  "http://localhost:3000",
  "https://statussy.com",
  "https://www.statussy.com",
  "https://*.vercel.app",
  process.env.BETTER_AUTH_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
].filter((origin): origin is string => Boolean(origin))

/** Only used while `next build` collects page data — never at runtime. */
const BUILD_PLACEHOLDER_SECRET =
  "statussy-next-build-placeholder-secret-do-not-use"

export const auth = betterAuth({
  appName: "Statussy",
  database: getAuthPool(),
  secret:
    process.env.BETTER_AUTH_SECRET ??
    (process.env.NEXT_PHASE === "phase-production-build"
      ? BUILD_PLACEHOLDER_SECRET
      : undefined),
  baseURL: {
    allowedHosts: [
      "localhost:3000",
      "localhost",
      "statussy.com",
      "www.statussy.com",
      "*.vercel.app",
    ],
    fallback: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  },
  trustedOrigins,
  advanced: {
    database: {
      // Worker SQL migrations own the schema; skip a live DB probe at import
      // so `next build` / typecheck work without Railway credentials.
      validateSchema: false,
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"],
    },
  },
  socialProviders: {
    ...(googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {}),
    ...(githubClientId && githubClientSecret
      ? {
          github: {
            clientId: githubClientId,
            clientSecret: githubClientSecret,
          },
        }
      : {}),
  },
  plugins: [
    magicLink({
      sendMagicLink: sendMagicLinkEmail,
    }),
    nextCookies(),
  ],
})
