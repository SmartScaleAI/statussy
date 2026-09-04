import type pg from "pg"

/**
 * Static registry of the 10 AI providers on the Statussy board.
 * Mirrors the ids in the Next.js app's data/services.ts (and public/logos/{id}.svg).
 * fetcher_type stays 'none' until fetchers land in later tickets.
 */
export const PROVIDER_SEED = [
  { id: "openai", name: "OpenAI", statusUrl: "https://status.openai.com/" },
  { id: "anthropic", name: "Anthropic", statusUrl: "https://status.claude.com/" },
  { id: "google-gemini", name: "Google Gemini", statusUrl: "https://aistudio.google.com/status" },
  { id: "xai", name: "xAI", statusUrl: "https://status.x.ai/" },
  { id: "mistral", name: "Mistral", statusUrl: "https://status.mistral.ai/" },
  { id: "groq", name: "Groq", statusUrl: "https://groqstatus.com/" },
  { id: "perplexity", name: "Perplexity", statusUrl: "https://status.perplexity.com/" },
  { id: "deepseek", name: "DeepSeek", statusUrl: "https://status.deepseek.com/" },
  { id: "cohere", name: "Cohere", statusUrl: "https://status.cohere.com/" },
  { id: "openrouter", name: "OpenRouter", statusUrl: "https://status.openrouter.ai/" },
] as const

export async function seedProviders(pool: pg.Pool): Promise<void> {
  for (const provider of PROVIDER_SEED) {
    await pool.query(
      `INSERT INTO providers (id, name, category, status_url, fetcher_type)
       VALUES ($1, $2, 'ai', $3, 'none')
       ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             status_url = EXCLUDED.status_url,
             updated_at = now()`,
      [provider.id, provider.name, provider.statusUrl],
    )
  }
}
