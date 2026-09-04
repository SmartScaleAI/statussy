import type pg from "pg"

/**
 * Static registry of the 10 AI services on the Statussy board.
 * Mirrors the ids in the Next.js app's data/services.ts (and public/logos/{id}.svg).
 * fetcher_type stays 'none' until a fetcher lands for that service.
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
