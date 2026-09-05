import type pg from "pg"

/**
 * Static registry of board services (26 AI + Cloud Waves A–C).
 * Mirrors the ids in the Next.js app's data/services.ts (and public/logos/{id}.svg).
 * Coding agents (Cursor, Windsurf, Devin, GitHub Copilot) are parked for a
 * future Developer category and must not be seeded here.
 *
 * `category` defaults to `ai` when omitted. AWS and Azure are `none` until
 * a dedicated Health-dashboard fetcher exists.
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
  {
    id: "vercel",
    name: "Vercel",
    category: "cloud",
    statusUrl: "https://www.vercel-status.com/",
    fetcherType: "statuspage",
  },
  {
    id: "railway",
    name: "Railway",
    category: "cloud",
    statusUrl: "https://status.railway.com/",
    fetcherType: "railway",
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    category: "cloud",
    statusUrl: "https://www.cloudflarestatus.com/",
    fetcherType: "statuspage",
  },
  {
    id: "render",
    name: "Render",
    category: "cloud",
    statusUrl: "https://status.render.com/",
    fetcherType: "statuspage",
  },
  {
    id: "fly",
    name: "Fly.io",
    category: "cloud",
    statusUrl: "https://status.flyio.net/",
    fetcherType: "statuspage",
  },
  {
    id: "netlify",
    name: "Netlify",
    category: "cloud",
    statusUrl: "https://www.netlifystatus.com/",
    fetcherType: "statuspage",
  },
  {
    id: "digitalocean",
    name: "DigitalOcean",
    category: "cloud",
    statusUrl: "https://status.digitalocean.com/",
    fetcherType: "statuspage",
  },
  {
    id: "google-cloud",
    name: "Google Cloud",
    category: "cloud",
    statusUrl: "https://status.cloud.google.com/",
    fetcherType: "google_cloud",
  },
  {
    id: "aws",
    name: "AWS",
    category: "cloud",
    statusUrl: "https://health.aws.amazon.com/health/status",
    fetcherType: "none",
  },
  {
    id: "azure",
    name: "Azure",
    category: "cloud",
    statusUrl: "https://azure.microsoft.com/status/",
    fetcherType: "none",
  },
  {
    id: "heroku",
    name: "Heroku",
    category: "cloud",
    statusUrl: "https://status.salesforce.com/products/Heroku",
    fetcherType: "heroku",
  },
  {
    id: "linode",
    name: "Linode",
    category: "cloud",
    statusUrl: "https://status.linode.com/",
    fetcherType: "statuspage",
  },
  {
    id: "fastly",
    name: "Fastly",
    category: "cloud",
    statusUrl: "https://www.fastlystatus.com/",
    fetcherType: "none",
  },
  {
    id: "bunny",
    name: "bunny.net",
    category: "cloud",
    statusUrl: "https://status.bunny.net/",
    fetcherType: "statuspage",
  },
  {
    id: "deno",
    name: "Deno Deploy",
    category: "cloud",
    statusUrl: "https://denostatus.com/",
    fetcherType: "instatus",
  },
  {
    id: "koyeb",
    name: "Koyeb",
    category: "cloud",
    statusUrl: "https://status.koyeb.com/",
    fetcherType: "instatus",
  },
  {
    id: "modal",
    name: "Modal",
    category: "cloud",
    statusUrl: "https://status.modal.com/",
    fetcherType: "betterstack",
  },
  {
    id: "firebase",
    name: "Firebase",
    category: "cloud",
    statusUrl: "https://status.firebase.google.com/",
    fetcherType: "google_cloud",
  },
  {
    id: "akamai",
    name: "Akamai",
    category: "cloud",
    statusUrl: "https://www.akamaistatus.com/",
    fetcherType: "statuspage",
  },
  {
    id: "vultr",
    name: "Vultr",
    category: "cloud",
    statusUrl: "https://status.vultr.com/",
    fetcherType: "vultr",
  },
  {
    id: "scaleway",
    name: "Scaleway",
    category: "cloud",
    statusUrl: "https://status.scaleway.com/",
    fetcherType: "statuspage",
  },
  {
    id: "oracle-cloud",
    name: "Oracle Cloud",
    category: "cloud",
    statusUrl: "https://ocistatus.oraclecloud.com/",
    fetcherType: "oracle_cloud",
  },
  {
    id: "hetzner",
    name: "Hetzner",
    category: "cloud",
    statusUrl: "https://status.hetzner.com/",
    fetcherType: "hetzner",
  },
  {
    id: "northflank",
    name: "Northflank",
    category: "cloud",
    statusUrl: "https://status.northflank.com/",
    fetcherType: "instatus",
  },
  {
    id: "lambda",
    name: "Lambda",
    category: "cloud",
    statusUrl: "https://status.lambda.ai/",
    fetcherType: "statuspage",
  },
] as const

function seedCategory(service: { id: string }): string {
  return "category" in service && typeof service.category === "string"
    ? service.category
    : "ai"
}

export async function seedServices(pool: pg.Pool): Promise<void> {
  for (const service of SERVICE_SEED) {
    await pool.query(
      `INSERT INTO services (id, name, category, status_url, fetcher_type)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             category = EXCLUDED.category,
             status_url = EXCLUDED.status_url,
             fetcher_type = EXCLUDED.fetcher_type,
             updated_at = now()`,
      [
        service.id,
        service.name,
        seedCategory(service),
        service.statusUrl,
        "fetcherType" in service ? service.fetcherType : "none",
      ],
    )
  }
}
