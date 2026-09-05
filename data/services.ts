/**
 * Single mock source for the v0 board.
 *
 * Live Statuspage / RSS should map onto this `Service` shape:
 * - Keep `id`, `name`, `category`, and `statusUrl` in config.
 * - Fill `status`, `incidentTitle`, and `updatedAt` from the feed.
 * Do not scrape service status pages from the client.
 */
export const SERVICE_STATUSES = [
  "operational",
  "degraded",
  "partial_outage",
  "major_outage",
  "maintenance",
] as const

export type ServiceStatus = (typeof SERVICE_STATUSES)[number]

export type ServiceCategory = "ai" | "cloud" | "developer"

export type Service = {
  /** Matches a static mark at `public/logos/{id}.svg`. */
  id: string
  name: string
  category: ServiceCategory
  /** Official vendor status page. */
  statusUrl: string
  status: ServiceStatus
  /** Short incident or maintenance title when not fully operational. */
  incidentTitle?: string
  updatedAt: string
}

export const LAST_REFRESHED_AT = "2026-09-03T21:40:00.000Z"

export const services: Service[] = [
  {
    id: "openai",
    name: "OpenAI",
    category: "ai",
    statusUrl: "https://status.openai.com/",
    status: "operational",
    updatedAt: "2026-09-03T21:30:00.000Z",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    category: "ai",
    statusUrl: "https://status.claude.com/",
    status: "operational",
    updatedAt: "2026-09-03T21:28:00.000Z",
  },
  {
    id: "google-gemini",
    name: "Google Gemini",
    category: "ai",
    statusUrl: "https://aistudio.google.com/status",
    status: "degraded",
    incidentTitle: "Elevated latency on generateContent",
    updatedAt: "2026-09-03T20:55:00.000Z",
  },
  {
    id: "xai",
    name: "xAI",
    category: "ai",
    statusUrl: "https://status.x.ai/",
    status: "operational",
    updatedAt: "2026-09-03T21:26:00.000Z",
  },
  {
    id: "mistral",
    name: "Mistral",
    category: "ai",
    statusUrl: "https://status.mistral.ai/",
    status: "operational",
    updatedAt: "2026-09-03T21:22:00.000Z",
  },
  {
    id: "groq",
    name: "Groq",
    category: "ai",
    statusUrl: "https://groqstatus.com/",
    status: "operational",
    updatedAt: "2026-09-03T21:31:00.000Z",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    category: "ai",
    statusUrl: "https://status.perplexity.com/",
    status: "operational",
    updatedAt: "2026-09-03T21:18:00.000Z",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    category: "ai",
    statusUrl: "https://status.deepseek.com/",
    status: "major_outage",
    incidentTitle: "Chat API unavailable",
    updatedAt: "2026-09-03T21:12:00.000Z",
  },
  {
    id: "cohere",
    name: "Cohere",
    category: "ai",
    statusUrl: "https://status.cohere.com/",
    status: "operational",
    updatedAt: "2026-09-03T21:24:00.000Z",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    category: "ai",
    statusUrl: "https://status.openrouter.ai/",
    status: "maintenance",
    incidentTitle: "Scheduled edge routing window",
    updatedAt: "2026-09-03T18:00:00.000Z",
  },
  // Wave B (SMA-41). Coding agents live under Developer, not AI.
  {
    id: "fireworks",
    name: "Fireworks AI",
    category: "ai",
    statusUrl: "https://status.fireworks.ai/",
    status: "operational",
    updatedAt: "2026-09-05T01:30:00.000Z",
  },
  {
    id: "together",
    name: "Together AI",
    category: "ai",
    statusUrl: "https://status.together.ai/",
    status: "operational",
    updatedAt: "2026-09-05T01:30:00.000Z",
  },
  {
    id: "cerebras",
    name: "Cerebras",
    category: "ai",
    statusUrl: "https://status.cerebras.ai/",
    status: "operational",
    updatedAt: "2026-09-05T01:30:00.000Z",
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    category: "ai",
    statusUrl: "https://status.huggingface.co/",
    status: "operational",
    updatedAt: "2026-09-05T01:30:00.000Z",
  },
  {
    id: "replicate",
    name: "Replicate",
    category: "ai",
    statusUrl: "https://status.replicate.com/",
    status: "operational",
    updatedAt: "2026-09-05T01:30:00.000Z",
  },
  {
    id: "runway",
    name: "Runway",
    category: "ai",
    statusUrl: "https://status.runwayml.com/",
    status: "operational",
    updatedAt: "2026-09-05T01:30:00.000Z",
  },
  {
    id: "ideogram",
    name: "Ideogram",
    category: "ai",
    statusUrl: "https://status.ideogram.ai/",
    status: "operational",
    updatedAt: "2026-09-05T01:30:00.000Z",
  },
  {
    id: "stability",
    name: "Stability AI",
    category: "ai",
    statusUrl: "https://status.stability.ai/",
    status: "operational",
    updatedAt: "2026-09-05T01:30:00.000Z",
  },
  // Wave C — stack-used AI products (fal, voice, embeddings, first-party labs).
  // Poe is omitted (consumer aggregator). Pinecone stays infra, not this wave.
  {
    id: "fal",
    name: "fal",
    category: "ai",
    statusUrl: "https://status.fal.ai/",
    status: "operational",
    updatedAt: "2026-09-05T02:20:00.000Z",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    category: "ai",
    statusUrl: "https://status.elevenlabs.io/",
    status: "operational",
    updatedAt: "2026-09-05T02:20:00.000Z",
  },
  {
    id: "minimax",
    name: "MiniMax",
    category: "ai",
    statusUrl: "https://status.minimax.io/",
    status: "operational",
    updatedAt: "2026-09-05T02:20:00.000Z",
  },
  {
    id: "voyage",
    name: "Voyage AI",
    category: "ai",
    statusUrl: "https://status.voyageai.com/",
    status: "operational",
    updatedAt: "2026-09-05T02:20:00.000Z",
  },
  {
    id: "bfl",
    name: "Black Forest Labs",
    category: "ai",
    statusUrl: "https://status.bfl.ml/",
    status: "operational",
    updatedAt: "2026-09-05T02:20:00.000Z",
  },
  {
    id: "cartesia",
    name: "Cartesia",
    category: "ai",
    statusUrl: "https://status.cartesia.ai/",
    status: "operational",
    updatedAt: "2026-09-05T02:20:00.000Z",
  },
  {
    id: "kimi",
    name: "Kimi",
    category: "ai",
    statusUrl: "https://status.moonshot.cn/",
    status: "operational",
    updatedAt: "2026-09-05T02:20:00.000Z",
  },
  {
    id: "luma",
    name: "Luma",
    category: "ai",
    statusUrl: "https://status.lumalabs.ai/",
    status: "operational",
    updatedAt: "2026-09-05T02:20:00.000Z",
  },
  // Cloud Wave A — hosting, edge, and the three hyperscalers. One card per
  // vendor (no CloudFront / Workers / Bedrock / Azure OpenAI splits).
  // AWS and Azure ship without a fetcher (custom dashboards, no public JSON).
  {
    id: "vercel",
    name: "Vercel",
    category: "cloud",
    statusUrl: "https://www.vercel-status.com/",
    status: "operational",
    updatedAt: "2026-09-05T02:50:00.000Z",
  },
  {
    id: "railway",
    name: "Railway",
    category: "cloud",
    statusUrl: "https://status.railway.com/",
    status: "operational",
    updatedAt: "2026-09-05T02:50:00.000Z",
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    category: "cloud",
    statusUrl: "https://www.cloudflarestatus.com/",
    status: "operational",
    updatedAt: "2026-09-05T02:50:00.000Z",
  },
  {
    id: "render",
    name: "Render",
    category: "cloud",
    statusUrl: "https://status.render.com/",
    status: "operational",
    updatedAt: "2026-09-05T02:50:00.000Z",
  },
  {
    id: "fly",
    name: "Fly.io",
    category: "cloud",
    statusUrl: "https://status.flyio.net/",
    status: "operational",
    updatedAt: "2026-09-05T02:50:00.000Z",
  },
  {
    id: "netlify",
    name: "Netlify",
    category: "cloud",
    statusUrl: "https://www.netlifystatus.com/",
    status: "operational",
    updatedAt: "2026-09-05T02:50:00.000Z",
  },
  {
    id: "digitalocean",
    name: "DigitalOcean",
    category: "cloud",
    statusUrl: "https://status.digitalocean.com/",
    status: "operational",
    updatedAt: "2026-09-05T02:50:00.000Z",
  },
  {
    id: "google-cloud",
    name: "Google Cloud",
    category: "cloud",
    statusUrl: "https://status.cloud.google.com/",
    status: "operational",
    updatedAt: "2026-09-05T02:50:00.000Z",
  },
  {
    id: "aws",
    name: "AWS",
    category: "cloud",
    statusUrl: "https://health.aws.amazon.com/health/status",
    status: "operational",
    updatedAt: "2026-09-05T02:50:00.000Z",
  },
  {
    id: "azure",
    name: "Azure",
    category: "cloud",
    statusUrl: "https://azure.microsoft.com/status/",
    status: "operational",
    updatedAt: "2026-09-05T02:50:00.000Z",
  },
  // Cloud Wave B — remaining core hosts / edge / BaaS with an easy official
  // feed. Fastly is seeded without a fetcher (status page blocks bots and
  // has no public JSON).
  {
    id: "heroku",
    name: "Heroku",
    category: "cloud",
    statusUrl: "https://status.salesforce.com/products/Heroku",
    status: "operational",
    updatedAt: "2026-09-05T03:15:00.000Z",
  },
  {
    id: "linode",
    name: "Linode",
    category: "cloud",
    statusUrl: "https://status.linode.com/",
    status: "operational",
    updatedAt: "2026-09-05T03:15:00.000Z",
  },
  {
    id: "fastly",
    name: "Fastly",
    category: "cloud",
    statusUrl: "https://www.fastlystatus.com/",
    status: "operational",
    updatedAt: "2026-09-05T03:15:00.000Z",
  },
  {
    id: "bunny",
    name: "bunny.net",
    category: "cloud",
    statusUrl: "https://status.bunny.net/",
    status: "operational",
    updatedAt: "2026-09-05T03:15:00.000Z",
  },
  {
    id: "deno",
    name: "Deno Deploy",
    category: "cloud",
    statusUrl: "https://denostatus.com/",
    status: "operational",
    updatedAt: "2026-09-05T03:15:00.000Z",
  },
  {
    id: "koyeb",
    name: "Koyeb",
    category: "cloud",
    statusUrl: "https://status.koyeb.com/",
    status: "operational",
    updatedAt: "2026-09-05T03:15:00.000Z",
  },
  {
    id: "modal",
    name: "Modal",
    category: "cloud",
    statusUrl: "https://status.modal.com/",
    status: "operational",
    updatedAt: "2026-09-05T03:15:00.000Z",
  },
  {
    id: "firebase",
    name: "Firebase",
    category: "cloud",
    statusUrl: "https://status.firebase.google.com/",
    status: "operational",
    updatedAt: "2026-09-05T03:15:00.000Z",
  },
  // Cloud Wave C — remaining real clouds with an official JSON (or Hetzner's
  // embedded Next payload). IBM / Backblaze / OVH / CoreWeave wait; Alibaba
  // and Tencent stay out; storage/auth/data products stay in later chiclets.
  {
    id: "akamai",
    name: "Akamai",
    category: "cloud",
    statusUrl: "https://www.akamaistatus.com/",
    status: "operational",
    updatedAt: "2026-09-05T03:30:00.000Z",
  },
  {
    id: "vultr",
    name: "Vultr",
    category: "cloud",
    statusUrl: "https://status.vultr.com/",
    status: "operational",
    updatedAt: "2026-09-05T03:30:00.000Z",
  },
  {
    id: "scaleway",
    name: "Scaleway",
    category: "cloud",
    statusUrl: "https://status.scaleway.com/",
    status: "operational",
    updatedAt: "2026-09-05T03:30:00.000Z",
  },
  {
    id: "oracle-cloud",
    name: "Oracle Cloud",
    category: "cloud",
    statusUrl: "https://ocistatus.oraclecloud.com/",
    status: "operational",
    updatedAt: "2026-09-05T03:30:00.000Z",
  },
  {
    id: "hetzner",
    name: "Hetzner",
    category: "cloud",
    statusUrl: "https://status.hetzner.com/",
    status: "operational",
    updatedAt: "2026-09-05T03:30:00.000Z",
  },
  {
    id: "northflank",
    name: "Northflank",
    category: "cloud",
    statusUrl: "https://status.northflank.com/",
    status: "operational",
    updatedAt: "2026-09-05T03:30:00.000Z",
  },
  {
    id: "lambda",
    name: "Lambda",
    category: "cloud",
    statusUrl: "https://status.lambda.ai/",
    status: "operational",
    updatedAt: "2026-09-05T03:30:00.000Z",
  },
  // Developer Wave A — where you write, review, and ship code. One card per
  // vendor: GitHub includes Copilot / Actions / Codespaces; Devin covers
  // Desktop + Cloud (Windsurf is the legacy name). Codex / Claude Code /
  // Amazon Q stay on their AI / Cloud parents.
  {
    id: "cursor",
    name: "Cursor",
    category: "developer",
    statusUrl: "https://status.cursor.com/",
    status: "operational",
    updatedAt: "2026-09-05T03:45:00.000Z",
  },
  {
    id: "devin",
    name: "Devin",
    category: "developer",
    statusUrl: "https://status.devin.ai/",
    status: "operational",
    updatedAt: "2026-09-05T03:45:00.000Z",
  },
  {
    id: "github",
    name: "GitHub",
    category: "developer",
    statusUrl: "https://www.githubstatus.com/",
    status: "operational",
    updatedAt: "2026-09-05T03:45:00.000Z",
  },
  {
    id: "gitlab",
    name: "GitLab",
    category: "developer",
    statusUrl: "https://status.gitlab.com/",
    status: "operational",
    updatedAt: "2026-09-05T03:45:00.000Z",
  },
  {
    id: "circleci",
    name: "CircleCI",
    category: "developer",
    statusUrl: "https://status.circleci.com/",
    status: "operational",
    updatedAt: "2026-09-05T03:45:00.000Z",
  },
  {
    id: "npm",
    name: "npm",
    category: "developer",
    statusUrl: "https://status.npmjs.org/",
    status: "operational",
    updatedAt: "2026-09-05T03:45:00.000Z",
  },
  {
    id: "docker",
    name: "Docker",
    category: "developer",
    statusUrl: "https://www.dockerstatus.com/",
    status: "operational",
    updatedAt: "2026-09-05T03:45:00.000Z",
  },
  {
    id: "linear",
    name: "Linear",
    category: "developer",
    statusUrl: "https://linearstatus.com/",
    status: "operational",
    updatedAt: "2026-09-05T03:45:00.000Z",
  },
  {
    id: "sourcegraph",
    name: "Sourcegraph",
    category: "developer",
    statusUrl: "https://sourcegraphstatus.com/",
    status: "operational",
    updatedAt: "2026-09-05T03:45:00.000Z",
  },
  {
    id: "warp",
    name: "Warp",
    category: "developer",
    statusUrl: "https://status.warp.dev/",
    status: "operational",
    updatedAt: "2026-09-05T03:45:00.000Z",
  },
]
