import type pg from "pg"

/**
 * Static registry of the 26 AI services on the Statussy board
 * (Wave A: 10; Wave B / SMA-41: 8; Wave C: 8 stack-used AI products).
 * Mirrors the ids in the Next.js app's data/services.ts (and public/logos/{id}.svg).
 * Coding agents (Cursor, Windsurf, Devin, GitHub Copilot) are parked for a
 * future Developer category and must not be seeded here.
 */
export const SERVICE_SEED = [
  {
    id: "openai",
    name: "OpenAI",
    statusUrl: "https://status.openai.com/",
    fetcherType: "statuspage",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    statusUrl: "https://status.claude.com/",
    fetcherType: "statuspage",
  },
  {
    id: "google-gemini",
    name: "Google Gemini",
    statusUrl: "https://aistudio.google.com/status",
    fetcherType: "google_cloud",
  },
  { id: "xai", name: "xAI", statusUrl: "https://status.x.ai/", fetcherType: "rss" },
  {
    id: "mistral",
    name: "Mistral",
    statusUrl: "https://status.mistral.ai/",
    fetcherType: "checkly_nuxt",
  },
  { id: "groq", name: "Groq", statusUrl: "https://groqstatus.com/", fetcherType: "statuspage" },
  {
    id: "perplexity",
    name: "Perplexity",
    statusUrl: "https://status.perplexity.com/",
    fetcherType: "instatus",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    statusUrl: "https://status.deepseek.com/",
    fetcherType: "rss",
  },
  {
    id: "cohere",
    name: "Cohere",
    statusUrl: "https://status.cohere.com/",
    fetcherType: "statuspage",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    statusUrl: "https://status.openrouter.ai/",
    fetcherType: "onlineornot",
  },
  {
    id: "fireworks",
    name: "Fireworks AI",
    statusUrl: "https://status.fireworks.ai/",
    fetcherType: "statuspage",
  },
  {
    id: "together",
    name: "Together AI",
    statusUrl: "https://status.together.ai/",
    fetcherType: "betterstack",
  },
  {
    id: "cerebras",
    name: "Cerebras",
    statusUrl: "https://status.cerebras.ai/",
    fetcherType: "statuspage",
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    statusUrl: "https://status.huggingface.co/",
    fetcherType: "betterstack",
  },
  {
    id: "replicate",
    name: "Replicate",
    statusUrl: "https://status.replicate.com/",
    fetcherType: "statuspage",
  },
  {
    id: "runway",
    name: "Runway",
    statusUrl: "https://status.runwayml.com/",
    fetcherType: "statuspage",
  },
  {
    id: "ideogram",
    name: "Ideogram",
    statusUrl: "https://status.ideogram.ai/",
    fetcherType: "statuspage",
  },
  {
    id: "stability",
    name: "Stability AI",
    statusUrl: "https://status.stability.ai/",
    fetcherType: "statuspage",
  },
  {
    id: "fal",
    name: "fal",
    statusUrl: "https://status.fal.ai/",
    fetcherType: "instatus",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    statusUrl: "https://status.elevenlabs.io/",
    fetcherType: "statuspage",
  },
  {
    id: "minimax",
    name: "MiniMax",
    statusUrl: "https://status.minimax.io/",
    fetcherType: "statuspage",
  },
  {
    id: "voyage",
    name: "Voyage AI",
    statusUrl: "https://status.voyageai.com/",
    fetcherType: "statuspage",
  },
  {
    id: "bfl",
    name: "Black Forest Labs",
    statusUrl: "https://status.bfl.ml/",
    fetcherType: "statuspage",
  },
  {
    id: "cartesia",
    name: "Cartesia",
    statusUrl: "https://status.cartesia.ai/",
    fetcherType: "statuspage",
  },
  {
    id: "kimi",
    name: "Kimi",
    statusUrl: "https://status.moonshot.cn/",
    fetcherType: "statuspage",
  },
  {
    id: "luma",
    name: "Luma",
    statusUrl: "https://status.lumalabs.ai/",
    fetcherType: "betterstack",
  },
] as const

export async function seedServices(pool: pg.Pool): Promise<void> {
  for (const service of SERVICE_SEED) {
    await pool.query(
      `INSERT INTO services (id, name, category, status_url, fetcher_type)
       VALUES ($1, $2, 'ai', $3, $4)
       ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             status_url = EXCLUDED.status_url,
             fetcher_type = EXCLUDED.fetcher_type,
             updated_at = now()`,
      [
        service.id,
        service.name,
        service.statusUrl,
        "fetcherType" in service ? service.fetcherType : "none",
      ],
    )
  }
}
