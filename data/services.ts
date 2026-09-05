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

export type ServiceCategory = "ai"

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
  // Wave B (SMA-41). Coding agents (Cursor, Windsurf, Devin, GitHub Copilot)
  // stay parked for a future Developer category.
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
]
