/**
 * Statussy worker (SMA-15 skeleton).
 *
 * On boot: applies migrations, seeds the static service registry, then ticks
 * on a fixed interval (REFRESH_INTERVAL_SECONDS, default 300 = 5 minutes).
 * Each tick fetches live status for services with a fetcher (OpenAI per
 * SMA-16; Anthropic, Groq, and Cohere per SMA-19 — all via the
 * Statuspage-compatible API; OpenRouter via OnlineOrNot, SMA-21; Perplexity
 * via Instatus, SMA-20; xAI and DeepSeek via their RSS/Atom status feeds,
 * SMA-22; Mistral via its Checkly/Nuxt `__NUXT_DATA__` HTML payload,
 * SMA-25; Google Gemini via Google Cloud Status incidents.json, SMA-26;
 * Wave B Statuspage services per SMA-41 — Fireworks, Cerebras, Replicate,
 * Runway, Ideogram, Stability; Together AI, Hugging Face, and Luma via Better
 * Stack `index.json`; Wave C Statuspage — ElevenLabs, MiniMax, Voyage, Black
 * Forest Labs, Cartesia, Kimi; fal via Instatus; Cloud Wave A — Vercel,
 * Cloudflare, Render, Fly.io, Netlify, DigitalOcean via Statuspage, Railway
 * via api.railwaystatus.com, Google Cloud via incidents.json; Cloud Wave B —
 * Linode and bunny.net via Statuspage, Heroku via Status API v4, Deno Deploy
 * and Koyeb via Instatus, Modal via Better Stack, Firebase via
 * status.firebase.google.com incidents.json; Cloud Wave C — Akamai,
 * Scaleway, and Lambda via Statuspage, Northflank via Instatus, Vultr via
 * status.json, Oracle Cloud via ocistatus status.json, Hetzner via the
 * official page's __NEXT_DATA__; Developer Wave A — Cursor, Devin, GitHub,
 * CircleCI, npm, Docker, Linear, Sourcegraph, and Warp via Statuspage,
 * GitLab via Status.io; Developer Wave B — Bitbucket, Buildkite, PyPI,
 * RubyGems, Maven Central, Postman, Augment, Factory, and Tabnine via
 * Statuspage, Zed via Instatus; Developer Wave C — Lovable, Bolt, Travis CI,
 * Semaphore, Harness, Codefresh, crates.io, Expo, and Cloudsmith via
 * Statuspage; Data Wave A — Supabase, PlanetScale, Convex, Upstash,
 * Pinecone, MongoDB, CockroachDB, and Prisma via Statuspage, Neon via
 * Status.io; Data Wave B — Snowflake, ClickHouse, Elastic, Aiven, InfluxDB,
 * Couchbase, Confluent, Tinybird, and Zilliz via Statuspage, Databricks via
 * Status.io; Data Wave C — Materialize, Redpanda, Yugabyte, and TiDB via
 * Statuspage, Turso, Qdrant, Meilisearch, and SurrealDB via Better Stack
 * `index.json`; Auth Wave A — Clerk, WorkOS, FusionAuth, Frontegg, and
 * 1Password via Statuspage, Auth0 via auth0.statuspage.io (custom domain
 * has no /api/v2), Stytch, Kinde, and PropelAuth via Instatus; Auth Wave B
 * — Duo, Ping Identity, Doppler, Infisical, Zitadel, JumpCloud, Magic, and
 * Beyond Identity via Statuspage, Descope via Instatus, Logto via Better
 * Stack `index.json`; Auth Wave C — LoginRadius, Scalekit, Transmit
 * Security, SecureAuth, Keeper, Yubico, Akeyless, SailPoint, and Delinea
 * via Statuspage, LastPass via lastpass.statuspage.io (the public host
 * challenges /api/v2); Payments Wave A — Stripe via www.stripestatus.com
 * (the public host has no /api/v2), Square, Paddle, Chargebee, Recurly,
 * Klarna, Plaid, and GoCardless via Statuspage; Payments Wave B — Mollie
 * via Instatus, Polar via Better Stack `index.json`, RevenueCat, Affirm,
 * FastSpring, Whop, Wise, Authorize.net, Flutterwave, and Airwallex via
 * Statuspage; Payments Wave C — Marqeta, Lithic, Worldpay, Spreedly,
 * Finix, Mercado Pago, EBANX, Paysafe, Recharge, and Maxio via
 * Statuspage (Maxio's public host times out on /api/v2, so the fetcher
 * hits maxio.statuspage.io); Observability Wave A — Datadog, Sentry,
 * Grafana, New Relic, Honeycomb, Splunk, and Axiom via Statuspage,
 * Dynatrace via Status.io, Better Stack via Better Stack `index.json`;
 * Observability Wave B — Sumo Logic, Coralogix, Rollbar, Bugsnag
 * (bugsnag.status.smartbear.com), incident.io, Mezmo, Airbrake, Cribl,
 * and logz.io via Statuspage; Observability Wave C — Lumigo, Netdata,
 * Scout, Logit.io, Nobl9, Catchpoint, VictoriaMetrics, Langfuse, and
 * Embrace via Statuspage, Dash0 via dash0status.com (the public host
 * redirects /api/v2); Email Wave A — Twilio, Mailgun, Klaviyo, Brevo,
 * SparkPost, Braze, Loops, and Mailjet via Statuspage, Resend via
 * resend-status.com (status.resend.com redirects), Customer.io via
 * customerio.statuspage.io (the public host has no /api/v2); Email
 * Wave B — Knock, Iterable, MailerSend, MailerLite, Kit, Front, and
 * Omnisend via Statuspage, SMTP2GO via smtp2gostatus.com (the public
 * host redirects /api/v2); Email Wave C — ActiveCampaign, GetResponse,
 * EmailOctopus, OneSignal, HubSpot, and Help Scout via Statuspage,
 * Nylas via status-v3.nylas.com (status.nylas.com redirects); Design
 * Wave A — Figma, Canva, Miro, Webflow, Lucid, Mural, and Frontify
 * via Statuspage, Framer via Better Stack `index.json`; Design Wave B
 * — Marvel, Balsamiq, and Anima via Statuspage; Design Wave C —
 * Beautiful.ai and Jitter via Statuspage; Infra Wave A — Terraform,
 * Vault, Consul, Nomad, and Packer via HashiCorp Statuspage, Pulumi
 * and Chef via Statuspage, Spacelift via spacelift.statuspage.io
 * (status.spacelift.io has no DNS), Crossplane via Upbound
 * Statuspage.
 * AWS, Azure, Fastly, Replit, Redis, Algolia, DataStax, Okta, PayPal,
 * Adyen, PagerDuty, Checkly, Postmark, Mailchimp, Campaign Monitor,
 * Mailtrap, Substack, Adobe, Sketch, Penpot, Rive, LottieFiles,
 * Whimsical, Lunacy, Photopea, Blender, Moqups, Proto.io, UXPin,
 * Overflow, Axure, Relume, Visily, Plasmic, and OpenTofu are seeded
 * without a fetcher) and writes snapshots, components,
 * and incidents to Postgres.
 * A tiny HTTP server exposes /healthz.
 */
import { createServer } from "node:http"
import { loadConfig } from "./config.js"
import { createPool } from "./db.js"
import { fetchChecklyNuxtState } from "./checkly-nuxt.js"
import { fetchInstatusState } from "./instatus.js"
import { runMigrations } from "./migrate.js"
import { fetchRssState } from "./rss.js"
import { seedServices } from "./seed.js"
import { fetchOnlineOrNotState } from "./onlineornot.js"
import {
  fetchFirebaseState,
  fetchGoogleCloudGeminiState,
  fetchGoogleCloudPlatformState,
} from "./google-cloud.js"
import {
  fetchGitlabState,
  fetchStatusIoState,
  DATABRICKS_STATUS_PAGE,
  DATABRICKS_STATUS_PAGE_ID,
  DYNATRACE_STATUS_PAGE,
  DYNATRACE_STATUS_PAGE_ID,
  NEON_STATUS_PAGE,
  NEON_STATUS_PAGE_ID,
} from "./gitlab.js"
import { fetchHerokuState } from "./heroku.js"
import { fetchHetznerState } from "./hetzner.js"
import { fetchOracleCloudState } from "./oracle-cloud.js"
import { fetchRailwayState } from "./railway.js"
import { fetchVultrState } from "./vultr.js"
import { fetchBetterstackState } from "./betterstack.js"
import { fetchStatuspageState } from "./statuspage.js"
import {
  markServiceStale,
  persistServiceState,
  type PersistableServiceState,
  type PersistOptions,
} from "./store.js"

const config = loadConfig()
const pool = createPool(config.databaseUrl)

const state = {
  startedAt: new Date(),
  tickCount: 0,
  lastTickAt: null as Date | null,
  lastTickOk: null as boolean | null,
}

console.log(
  `[worker] starting (interval=${config.refreshIntervalSeconds}s, port=${config.port})`,
)

const applied = await runMigrations(pool)
console.log(
  applied.length > 0
    ? `[worker] migrations applied: ${applied.join(", ")}`
    : "[worker] schema up to date",
)
await seedServices(pool)
console.log("[worker] service registry seeded")

const fetchOptions = () => ({
  timeoutMs: config.fetchTimeoutMs,
  userAgent: config.fetchUserAgent,
})

type ServiceJob = {
  id: string
  fetch: () => Promise<PersistableServiceState>
  persistOptions?: PersistOptions
}

// Board services with a fetcher (26 AI + Cloud / Developer / Data / Auth /
// Payments / Observability Waves A–C + Email Waves A–C + Design Waves
// A–C + Infra Wave A; AWS, Azure, Fastly, Replit, Redis, Algolia,
// DataStax, Okta, PayPal, Adyen, PagerDuty, Checkly, Postmark,
// Mailchimp, Campaign Monitor, Mailtrap, Substack, Adobe, Sketch,
// Penpot, Rive, LottieFiles, Whimsical, Lunacy, Photopea, Blender,
// Moqups, Proto.io, UXPin, Overflow, Axure, Relume, Visily, Plasmic,
// and OpenTofu are none).
const statuspageJob = (id: string, baseUrl: string): ServiceJob => ({
  id,
  fetch: () => fetchStatuspageState(baseUrl, fetchOptions()),
})

// SMA-22: services whose status page is only exposed as an RSS/Atom feed.
// Feed URLs are tried in order; DeepSeek serves the same items as both
// feed.rss and feed.atom.
const rssJob = (id: string, feedUrls: readonly string[]): ServiceJob => ({
  id,
  fetch: () => fetchRssState(feedUrls, fetchOptions()),
})

const SERVICE_JOBS: ServiceJob[] = [
  statuspageJob("openai", "https://status.openai.com"),
  statuspageJob("anthropic", "https://status.claude.com"),
  statuspageJob("groq", "https://groqstatus.com"),
  statuspageJob("cohere", "https://status.cohere.com"),
  {
    // SMA-21: OpenRouter via OnlineOrNot. The summary API only lists active
    // incidents, so ones that drop out are marked resolved at persist time.
    id: "openrouter",
    fetch: () => fetchOnlineOrNotState("status.openrouter.ai", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    // SMA-20: Perplexity via Instatus. summary.json also only carries
    // *active* incidents, so ones that drop out are resolved at persist time.
    id: "perplexity",
    fetch: () => fetchInstatusState("https://status.perplexity.com", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  rssJob("xai", ["https://status.x.ai/feed.xml"]),
  rssJob("deepseek", [
    "https://status.deepseek.com/feed.rss",
    "https://status.deepseek.com/feed.atom",
  ]),
  {
    // SMA-26: Gemini via Google Cloud Status incidents.json. The feed mixes
    // historical incidents; we persist Gemini-relevant rows and resolve any
    // previously open ones that drop out of the open set.
    id: "google-gemini",
    fetch: () => fetchGoogleCloudGeminiState(fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    // SMA-25: Mistral via Checkly/Nuxt HTML (__NUXT_DATA__). The payload only
    // lists *unresolved* incidents, so ones that drop out are resolved at
    // persist time. Parse/CF failures mark the latest snapshot stale.
    id: "mistral",
    fetch: () => fetchChecklyNuxtState("https://status.mistral.ai", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  // SMA-41 Wave B — Statuspage-compatible pages.
  statuspageJob("fireworks", "https://status.fireworks.ai"),
  statuspageJob("cerebras", "https://status.cerebras.ai"),
  statuspageJob("replicate", "https://status.replicate.com"),
  statuspageJob("runway", "https://status.runwayml.com"),
  statuspageJob("ideogram", "https://status.ideogram.ai"),
  statuspageJob("stability", "https://status.stability.ai"),
  {
    // SMA-41: Together + Hugging Face are Better Stack SPAs. The public
    // `index.json` the SPA loads is undocumented; persist treats dropped
    // reports as resolved.
    id: "together",
    fetch: () => fetchBetterstackState("https://status.together.ai", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    id: "huggingface",
    fetch: () => fetchBetterstackState("https://status.huggingface.co", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  // Wave C — Statuspage-compatible pages. Voyage's custom domain times out on
  // /api/v2, so the fetcher hits the Statuspage host directly.
  statuspageJob("elevenlabs", "https://status.elevenlabs.io"),
  statuspageJob("minimax", "https://status.minimax.io"),
  statuspageJob("voyage", "https://voyageai-status.statuspage.io"),
  statuspageJob("bfl", "https://status.bfl.ml"),
  statuspageJob("cartesia", "https://status.cartesia.ai"),
  statuspageJob("kimi", "https://status.moonshot.cn"),
  {
    // fal is Instatus (summary.json + components.json), same dialect as Perplexity.
    id: "fal",
    fetch: () => fetchInstatusState("https://status.fal.ai", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    // Luma is a Better Stack SPA, same index.json as Together / Hugging Face.
    id: "luma",
    fetch: () => fetchBetterstackState("https://status.lumalabs.ai", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  // Cloud Wave A — Statuspage-compatible hosts. Cloudflare's page-level
  // indicator is the official rollup (a single POP in maintenance must not
  // paint the card; mapStatuspage already uses status.indicator).
  statuspageJob("vercel", "https://www.vercel-status.com"),
  statuspageJob("cloudflare", "https://www.cloudflarestatus.com"),
  statuspageJob("render", "https://status.render.com"),
  statuspageJob("fly", "https://status.flyio.net"),
  statuspageJob("netlify", "https://www.netlifystatus.com"),
  statuspageJob("digitalocean", "https://status.digitalocean.com"),
  {
    id: "railway",
    fetch: () => fetchRailwayState(fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    // Platform-wide GCP card. Informational notices stay off the rollup.
    id: "google-cloud",
    fetch: () => fetchGoogleCloudPlatformState(fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  // Cloud Wave B. Fastly has no public JSON and blocks the worker UA.
  statuspageJob("linode", "https://status.linode.com"),
  statuspageJob("bunny", "https://status.bunny.net"),
  {
    id: "heroku",
    fetch: () => fetchHerokuState(fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    id: "deno",
    fetch: () => fetchInstatusState("https://denostatus.com", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    id: "koyeb",
    fetch: () => fetchInstatusState("https://status.koyeb.com", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    id: "modal",
    fetch: () => fetchBetterstackState("https://status.modal.com", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    id: "firebase",
    fetch: () => fetchFirebaseState(fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  // Cloud Wave C — Statuspage-compatible hosts plus custom official JSON.
  statuspageJob("akamai", "https://www.akamaistatus.com"),
  statuspageJob("scaleway", "https://status.scaleway.com"),
  statuspageJob("lambda", "https://status.lambda.ai"),
  {
    id: "northflank",
    fetch: () => fetchInstatusState("https://status.northflank.com", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    id: "vultr",
    fetch: () => fetchVultrState(fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    // status.json only (no summary/incidents API; skip the 1.7MB component dump).
    id: "oracle-cloud",
    fetch: () => fetchOracleCloudState(fetchOptions()),
  },
  {
    id: "hetzner",
    fetch: () => fetchHetznerState(fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  // Developer Wave A. Copilot / Actions / Codespaces stay GitHub components.
  statuspageJob("cursor", "https://status.cursor.com"),
  statuspageJob("devin", "https://status.devin.ai"),
  statuspageJob("github", "https://www.githubstatus.com"),
  {
    id: "gitlab",
    fetch: () => fetchGitlabState(fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  statuspageJob("circleci", "https://status.circleci.com"),
  statuspageJob("npm", "https://status.npmjs.org"),
  statuspageJob("docker", "https://www.dockerstatus.com"),
  statuspageJob("linear", "https://linearstatus.com"),
  statuspageJob("sourcegraph", "https://sourcegraphstatus.com"),
  statuspageJob("warp", "https://status.warp.dev"),
  // Developer Wave B. More forges, registries, API tooling, and coding agents.
  statuspageJob("bitbucket", "https://bitbucket.status.atlassian.com"),
  statuspageJob("buildkite", "https://www.buildkitestatus.com"),
  statuspageJob("pypi", "https://status.python.org"),
  statuspageJob("rubygems", "https://status.rubygems.org"),
  statuspageJob("maven", "https://status.maven.org"),
  statuspageJob("postman", "https://status.postman.com"),
  statuspageJob("augment", "https://status.augmentcode.com"),
  statuspageJob("factory", "https://status.factory.ai"),
  statuspageJob("tabnine", "https://status.tabnine.com"),
  {
    id: "zed",
    fetch: () => fetchInstatusState("https://status.zed.dev", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  // Developer Wave C. Replit is none (Cloudflare challenges status.replit.com).
  statuspageJob("lovable", "https://status.lovable.dev"),
  statuspageJob("bolt", "https://status.bolt.new"),
  statuspageJob("travis", "https://www.traviscistatus.com"),
  statuspageJob("semaphore", "https://status.semaphore.io"),
  statuspageJob("harness", "https://status.harness.io"),
  statuspageJob("codefresh", "https://status.codefresh.io"),
  statuspageJob("crates", "https://status.crates.io"),
  statuspageJob("expo", "https://status.expo.dev"),
  statuspageJob("cloudsmith", "https://status.cloudsmith.com"),
  // Data Wave A. Redis is none (custom status.redis.io page, no public JSON).
  statuspageJob("supabase", "https://status.supabase.com"),
  {
    id: "neon",
    fetch: () => fetchStatusIoState(NEON_STATUS_PAGE, NEON_STATUS_PAGE_ID, fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  statuspageJob("planetscale", "https://www.planetscalestatus.com"),
  statuspageJob("convex", "https://status.convex.dev"),
  statuspageJob("upstash", "https://status.upstash.com"),
  statuspageJob("pinecone", "https://status.pinecone.io"),
  statuspageJob("mongodb", "https://status.mongodb.com"),
  statuspageJob("cockroach", "https://status.cockroachlabs.cloud"),
  statuspageJob("prisma", "https://www.prisma-status.com"),
  // Data Wave B. Databricks is Status.io (one card; GCP/Azure pages stay here).
  statuspageJob("snowflake", "https://status.snowflake.com"),
  {
    id: "databricks",
    fetch: () =>
      fetchStatusIoState(
        DATABRICKS_STATUS_PAGE,
        DATABRICKS_STATUS_PAGE_ID,
        fetchOptions(),
      ),
    persistOptions: { resolveMissingIncidents: true },
  },
  statuspageJob("clickhouse", "https://status.clickhouse.com"),
  statuspageJob("elastic", "https://status.elastic.co"),
  statuspageJob("aiven", "https://status.aiven.io"),
  statuspageJob("influxdb", "https://status.influxdata.com"),
  statuspageJob("couchbase", "https://status.couchbase.com"),
  statuspageJob("confluent", "https://status.confluent.cloud"),
  statuspageJob("tinybird", "https://status.tinybird.co"),
  statuspageJob("zilliz", "https://status.zilliz.com"),
  // Data Wave C. Algolia is a custom SPA; DataStax Statuspage is inactive.
  statuspageJob("materialize", "https://status.materialize.com"),
  {
    id: "turso",
    fetch: () => fetchBetterstackState("https://status.turso.tech", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    id: "qdrant",
    fetch: () => fetchBetterstackState("https://status.qdrant.io", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    id: "meilisearch",
    fetch: () => fetchBetterstackState("https://status.meilisearch.com", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  statuspageJob("redpanda", "https://status.redpanda.com"),
  {
    id: "surreal",
    fetch: () => fetchBetterstackState("https://status.surrealdb.com", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  statuspageJob("yugabyte", "https://status.yugabyte.cloud"),
  statuspageJob("tidb", "https://status.tidbcloud.com"),
  // Auth Wave A. Auth0's public host has no /api/v2; hit the Statuspage host.
  // Okta status.okta.com returns 401 for JSON (same pattern as Fastly).
  statuspageJob("auth0", "https://auth0.statuspage.io"),
  statuspageJob("clerk", "https://status.clerk.com"),
  statuspageJob("workos", "https://status.workos.com"),
  {
    id: "stytch",
    fetch: () => fetchInstatusState("https://status.stytch.com", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    id: "kinde",
    fetch: () => fetchInstatusState("https://status.kinde.com", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  statuspageJob("fusionauth", "https://status.fusionauth.io"),
  statuspageJob("frontegg", "https://status.frontegg.com"),
  {
    id: "propelauth",
    fetch: () => fetchInstatusState("https://status.propelauth.com", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  statuspageJob("onepassword", "https://status.1password.com"),
  // Auth Wave B.
  {
    id: "descope",
    fetch: () => fetchInstatusState("https://descopestatus.com", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  statuspageJob("duo", "https://status.duo.com"),
  statuspageJob("ping-identity", "https://status.pingidentity.com"),
  statuspageJob("doppler", "https://www.dopplerstatus.com"),
  statuspageJob("infisical", "https://status.infisical.com"),
  statuspageJob("zitadel", "https://www.zitadelstatus.com"),
  statuspageJob("jumpcloud", "https://status.jumpcloud.com"),
  {
    id: "logto",
    fetch: () => fetchBetterstackState("https://status.logto.io", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  statuspageJob("magic", "https://status.magic.link"),
  statuspageJob("beyond-identity", "https://status.beyondidentity.com"),
  // Auth Wave C. LastPass's public host challenges /api/v2; hit the
  // Statuspage host (same pattern as Auth0).
  statuspageJob("loginradius", "https://status.loginradius.com"),
  statuspageJob("scalekit", "https://scalekit.statuspage.io"),
  statuspageJob("transmit-security", "https://status.transmitsecurity.io"),
  statuspageJob("secureauth", "https://status.secureauth.com"),
  statuspageJob("lastpass", "https://lastpass.statuspage.io"),
  statuspageJob("keeper", "https://statuspage.keeper.io"),
  statuspageJob("yubico", "https://status.yubico.com"),
  statuspageJob("akeyless", "https://status.akeyless.io"),
  statuspageJob("sailpoint", "https://status.sailpoint.com"),
  statuspageJob("delinea", "https://status.delinea.com"),
  // Payments Wave A. Stripe's public host has no /api/v2; hit the
  // Statuspage host. PayPal and Adyen have no usable public JSON.
  statuspageJob("stripe", "https://www.stripestatus.com"),
  statuspageJob("square", "https://www.issquareup.com"),
  statuspageJob("paddle", "https://paddlestatus.com"),
  statuspageJob("chargebee", "https://status.chargebee.com"),
  statuspageJob("recurly", "https://status.recurly.com"),
  statuspageJob("klarna", "https://status.klarna.com"),
  statuspageJob("plaid", "https://status.plaid.com"),
  statuspageJob("gocardless", "https://www.gocardless-status.com"),
  // Payments Wave B. Mollie is Instatus; Polar is a Better Stack SPA.
  {
    id: "mollie",
    fetch: () => fetchInstatusState("https://status.mollie.com", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    id: "polar",
    fetch: () => fetchBetterstackState("https://status.polar.sh", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  statuspageJob("revenuecat", "https://status.revenuecat.com"),
  statuspageJob("affirm", "https://status.affirm.com"),
  statuspageJob("fastspring", "https://status.fastspring.com"),
  statuspageJob("whop", "https://status.whop.com"),
  statuspageJob("wise", "https://status.wise.com"),
  statuspageJob("authorize-net", "https://status.authorize.net"),
  statuspageJob("flutterwave", "https://status.flutterwave.com"),
  statuspageJob("airwallex", "https://status.airwallex.com"),
  // Payments Wave C. Maxio's public host times out on /api/v2; hit the
  // Statuspage host (same pattern as Stripe / Auth0 / Voyage).
  statuspageJob("marqeta", "https://status.marqeta.com"),
  statuspageJob("lithic", "https://status.lithic.com"),
  statuspageJob("worldpay", "https://status.worldpay.com"),
  statuspageJob("spreedly", "https://status.spreedly.com"),
  statuspageJob("finix", "https://status.finix.com"),
  statuspageJob("mercado-pago", "https://status.mercadopago.com"),
  statuspageJob("ebanx", "https://status.ebanx.com"),
  statuspageJob("paysafe", "https://status.paysafe.com"),
  statuspageJob("recharge", "https://status.getrecharge.com"),
  statuspageJob("maxio", "https://maxio.statuspage.io"),
  // Observability Wave A. PagerDuty is none (custom page, no public JSON).
  // Splunk's public status.splunk.com is marketing HTML; the live Cloud
  // Platform page is Statuspage. Dynatrace is Status.io
  // (status.dynatrace.com → dynatrace.status.io).
  statuspageJob("datadog", "https://status.datadoghq.com"),
  statuspageJob("sentry", "https://status.sentry.io"),
  statuspageJob("grafana", "https://status.grafana.com"),
  statuspageJob("new-relic", "https://status.newrelic.com"),
  statuspageJob("honeycomb", "https://status.honeycomb.io"),
  statuspageJob("splunk", "https://status.splunkcloud.com"),
  {
    id: "dynatrace",
    fetch: () =>
      fetchStatusIoState(
        DYNATRACE_STATUS_PAGE,
        DYNATRACE_STATUS_PAGE_ID,
        fetchOptions(),
      ),
    persistOptions: { resolveMissingIncidents: true },
  },
  {
    id: "better-stack",
    fetch: () =>
      fetchBetterstackState("https://status.betterstack.com", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  statuspageJob("axiom", "https://status.axiom.co"),
  // Observability Wave B. Checkly is none (own Nuxt page, no public JSON).
  // Bugsnag's public host redirects; hit the SmartBear Statuspage host.
  statuspageJob("sumo-logic", "https://status.sumologic.com"),
  statuspageJob("coralogix", "https://status.coralogix.com"),
  statuspageJob("rollbar", "https://status.rollbar.com"),
  statuspageJob("bugsnag", "https://bugsnag.status.smartbear.com"),
  statuspageJob("incident-io", "https://status.incident.io"),
  statuspageJob("mezmo", "https://status.mezmo.com"),
  statuspageJob("airbrake", "https://status.airbrake.io"),
  statuspageJob("cribl", "https://status.cribl.cloud"),
  statuspageJob("logz", "https://status.logz.io"),
  // Observability Wave C. Dash0's public host redirects /api/v2; hit
  // dash0status.com. Langfuse and Embrace expose Statuspage-compatible
  // /api/v2 on Instatus-hosted pages.
  statuspageJob("lumigo", "https://status.lumigo.io"),
  statuspageJob("netdata", "https://status.netdata.cloud"),
  statuspageJob("scout", "https://status.scoutapm.com"),
  statuspageJob("logit", "https://status.logit.io"),
  statuspageJob("nobl9", "https://status.nobl9.com"),
  statuspageJob("catchpoint", "https://status.catchpoint.com"),
  statuspageJob("victoria-metrics", "https://status.victoriametrics.com"),
  statuspageJob("langfuse", "https://status.langfuse.com"),
  statuspageJob("dash0", "https://dash0status.com"),
  statuspageJob("embrace", "https://status.embrace.io"),
  // Email Wave A. SendGrid stays on Twilio (same Statuspage). SES stays
  // on AWS. Resend's public host redirects; hit resend-status.com.
  // Customer.io's public host has no /api/v2; hit the Statuspage host.
  statuspageJob("twilio", "https://status.twilio.com"),
  statuspageJob("mailgun", "https://status.mailgun.com"),
  statuspageJob("resend", "https://resend-status.com"),
  statuspageJob("klaviyo", "https://status.klaviyo.com"),
  statuspageJob("brevo", "https://status.brevo.com"),
  statuspageJob("customer-io", "https://customerio.statuspage.io"),
  statuspageJob("sparkpost", "https://status.sparkpost.com"),
  statuspageJob("braze", "https://status.braze.com"),
  statuspageJob("loops", "https://status.loops.so"),
  statuspageJob("mailjet", "https://status.mailjet.com"),
  // Email Wave B. Courier waits (no official vector). Mandrill stays
  // on Mailchimp. SMTP2GO's public host redirects; hit smtp2gostatus.com.
  // Postmark and Mailchimp are custom pages with no /api/v2.
  statuspageJob("knock", "https://status.knock.app"),
  statuspageJob("iterable", "https://status.iterable.com"),
  statuspageJob("mailersend", "https://status.mailersend.com"),
  statuspageJob("mailerlite", "https://status.mailerlite.com"),
  statuspageJob("smtp2go", "https://smtp2gostatus.com"),
  statuspageJob("kit", "https://status.kit.com"),
  statuspageJob("front", "https://www.frontstatus.com"),
  statuspageJob("omnisend", "https://status.omnisend.com"),
  // Email Wave C. Courier / Drip / AWeber / Constant Contact / Beehiiv
  // wait (no official vector). Nylas's public host redirects; hit
  // status-v3.nylas.com. Campaign Monitor 403s /api/v2. Mailtrap and
  // Substack are custom pages with no Statuspage /api/v2.
  statuspageJob("activecampaign", "https://status.activecampaign.com"),
  statuspageJob("getresponse", "https://status.getresponse.com"),
  statuspageJob("nylas", "https://status-v3.nylas.com"),
  statuspageJob("emailoctopus", "https://status.emailoctopus.com"),
  statuspageJob("onesignal", "https://status.onesignal.com"),
  statuspageJob("hubspot", "https://status.hubspot.com"),
  statuspageJob("help-scout", "https://status.helpscout.com"),
  // Design Wave A. FigJam / Dev Mode stay on Figma. Photoshop /
  // Illustrator / XD stay on Adobe. Lucidspark stays on Lucid. Spline
  // waits (no official vector). Adobe's custom SPA and Sketch's
  // summary.json have no existing fetcher. Framer is Better Stack.
  statuspageJob("figma", "https://status.figma.com"),
  statuspageJob("canva", "https://www.canvastatus.com"),
  {
    id: "framer",
    fetch: () =>
      fetchBetterstackState("https://www.framerstatus.com", fetchOptions()),
    persistOptions: { resolveMissingIncidents: true },
  },
  statuspageJob("miro", "https://status.miro.com"),
  statuspageJob("webflow", "https://status.webflow.com"),
  statuspageJob("lucid", "https://status.lucid.co"),
  statuspageJob("mural", "https://status.mural.co"),
  statuspageJob("frontify", "https://status.frontify.com"),
  // Design Wave B. Affinity stays on Canva. Abstract / InVision stay
  // off (sunset). Spline still waits. Rive is summary.json only.
  // LottieFiles / Penpot / Whimsical / Lunacy / Photopea / Blender
  // have no Statuspage /api/v2.
  statuspageJob("marvel", "https://status.marvelapp.com"),
  statuspageJob("balsamiq", "https://status.balsamiq.com"),
  statuspageJob("anima", "https://status.animaapp.com"),
  // Design Wave C. Spline still waits. Zeplin / ProtoPie / Builder.io
  // wait. Jitter's public host has no /api/v2; hit jitter.statuspage.io.
  statuspageJob("beautiful-ai", "https://status.beautiful.ai"),
  statuspageJob("jitter", "https://jitter.statuspage.io"),
  // Infra Wave A. HashiCorp products share one Statuspage (HCP
  // rollup). Spacelift's public host has no DNS; hit the Statuspage
  // host. Crossplane polls Upbound (commercial parent). OpenTofu
  // is none (GitLab-looking HTML, no /api/v2).
  statuspageJob("terraform", "https://status.hashicorp.com"),
  statuspageJob("pulumi", "https://status.pulumi.com"),
  statuspageJob("vault", "https://status.hashicorp.com"),
  statuspageJob("consul", "https://status.hashicorp.com"),
  statuspageJob("nomad", "https://status.hashicorp.com"),
  statuspageJob("spacelift", "https://spacelift.statuspage.io"),
  statuspageJob("crossplane", "https://status.upbound.io"),
  statuspageJob("packer", "https://status.hashicorp.com"),
  statuspageJob("chef", "https://status.chef.io"),
]

async function fetchService(service: ServiceJob): Promise<boolean> {
  try {
    const fetched = await service.fetch()
    await persistServiceState(
      pool,
      service.id,
      fetched,
      service.persistOptions,
    )
    console.log(
      `[fetch] ${service.id} ok status=${fetched.status} components=${fetched.components.length} incidents=${fetched.incidents.length}`,
    )
    return true
  } catch (err) {
    console.error(`[fetch] ${service.id} failed: ${(err as Error).message}`)
    // Keep last-known rows; just flag the latest snapshot as stale.
    await markServiceStale(pool, service.id).catch((staleErr: Error) => {
      console.error(`[fetch] ${service.id} could not mark stale: ${staleErr.message}`)
    })
    return false
  }
}

async function runTick(): Promise<void> {
  const tickNumber = ++state.tickCount
  try {
    const results = await Promise.all(
      SERVICE_JOBS.map((service) => fetchService(service)),
    )
    const okCount = results.filter(Boolean).length
    state.lastTickAt = new Date()
    state.lastTickOk = okCount === results.length
    console.log(
      `[tick] #${tickNumber} done ok=${okCount}/${results.length} at=${state.lastTickAt.toISOString()}`,
    )
  } catch (err) {
    state.lastTickAt = new Date()
    state.lastTickOk = false
    console.error(`[tick] #${tickNumber} failed: ${(err as Error).message}`)
  }
}

const server = createServer((req, res) => {
  if (req.url === "/healthz" || req.url === "/") {
    res.writeHead(200, { "content-type": "application/json" })
    res.end(
      JSON.stringify({
        status: "ok",
        startedAt: state.startedAt.toISOString(),
        refreshIntervalSeconds: config.refreshIntervalSeconds,
        tickCount: state.tickCount,
        lastTickAt: state.lastTickAt?.toISOString() ?? null,
        lastTickOk: state.lastTickOk,
      }),
    )
    return
  }
  res.writeHead(404, { "content-type": "application/json" })
  res.end(JSON.stringify({ status: "not_found" }))
})
server.listen(config.port, () => {
  console.log(`[worker] health endpoint on :${config.port}/healthz`)
})

await runTick()
const interval = setInterval(runTick, config.refreshIntervalSeconds * 1000)

function shutdown(signal: string): void {
  console.log(`[worker] received ${signal}, shutting down`)
  clearInterval(interval)
  server.close()
  void pool.end().finally(() => process.exit(0))
}
process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))
