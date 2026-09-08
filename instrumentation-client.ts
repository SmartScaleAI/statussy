/**
 * PostHog Web analytics (SMA-102). Official Next.js 15.3+ / App Router
 * pattern: client instrumentation before hydration.
 *
 * Autocapture + history-change pageviews come from `defaults: "2026-05-30"`.
 * Skip init when the project token is unset so local / preview builds stay
 * no-op. Accepts PostHog's current `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` or
 * the issue's `NEXT_PUBLIC_POSTHOG_KEY` alias.
 */
import posthog from "posthog-js"

const key =
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ||
  process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()

if (key) {
  try {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      defaults: "2026-05-30",
    })
  } catch {
    // Analytics must never take down the app.
  }
}
