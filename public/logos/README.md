# Service logos

One static SVG per board service. Filename = `Service.id` from `data/services.ts`.

**Rule for every new service:** use the official brand path. Do not draw a geometric stand-in. Prefer [Simple Icons](https://simpleicons.org) when the slug is that vendor; otherwise LobeHub traces of the official mark, Wikimedia, or the vendor’s own SVG (favicon / brand kit). Only draw a replica if no official path exists. Fills keep official color when it reads on the dark board. Official black / near-black lockups are knocked out to white (or a documented chromatic token). No animation, no CDN at runtime.

| File | Service | Fill | Source |
| --- | --- | --- | --- |
| `openai.svg` | OpenAI | `#10A37F` | [Simple Icons](https://simpleicons.org) `openai` path; green accent so the official black bloom reads on dark |
| `anthropic.svg` | Anthropic | `#D97757` | Simple Icons `anthropic` path; Claude Clay token (official lockup is `#191919`) |
| `google-gemini.svg` | Google Gemini | Official sparkle colors | [LobeHub](https://github.com/lobehub/lobe-icons) `gemini-color` (official Gemini mark + gradient) |
| `xai.svg` | xAI | `#FFFFFF` | LobeHub `xai` Grok geometric mark; white on dark |
| `mistral.svg` | Mistral | `#FA520F` | Simple Icons `mistralai` ([chat.mistral.ai](https://chat.mistral.ai)) |
| `groq.svg` | Groq | `#F55036` | LobeHub `groq` (not in Simple Icons); Groq orange |
| `perplexity.svg` | Perplexity | `#1FB8CD` | Simple Icons `perplexity` |
| `deepseek.svg` | DeepSeek | `#5786FE` | Simple Icons `deepseek` |
| `cohere.svg` | Cohere | `#FF7759` | LobeHub `cohere` (not in Simple Icons); Bittersweet accent |
| `openrouter.svg` | OpenRouter | `#94A3B8` | Simple Icons `openrouter` |
| `fireworks.svg` | Fireworks AI | `#FF5A00` | LobeHub `fireworks` (not in Simple Icons) |
| `together.svg` | Together AI | `#0B6BCB` | LobeHub `together` (not in Simple Icons) |
| `cerebras.svg` | Cerebras | `#F15A24` | LobeHub `cerebras` (not in Simple Icons) |
| `huggingface.svg` | Hugging Face | `#FFD21E` | Simple Icons `huggingface` |
| `replicate.svg` | Replicate | `#94A3B8` | Simple Icons `replicate` path; slate so official black reads on dark |
| `runway.svg` | Runway | `#FFFFFF` | LobeHub `runway` symbol ([runway.com/brand-guidelines](https://runway.com/brand-guidelines)); white on dark |
| `ideogram.svg` | Ideogram | `#E11D8F` | LobeHub `ideogram` (not in Simple Icons) |
| `stability.svg` | Stability AI | `#7C3AED` | LobeHub `stability` (not in Simple Icons) |
| `fal.svg` | fal | `#22C55E` | LobeHub `fal` (not in Simple Icons) |
| `elevenlabs.svg` | ElevenLabs | `#FFFFFF` | Simple Icons `elevenlabs`; white so official black reads on dark |
| `minimax.svg` | MiniMax | `#E73562` | Simple Icons `minimax` |
| `voyage.svg` | Voyage AI | `#2563EB` | LobeHub `voyage` (not in Simple Icons) |
| `bfl.svg` | Black Forest Labs | `#F59E0B` | LobeHub `bfl` |
| `cartesia.svg` | Cartesia | `#309D4B` / `#F9F9F8` | Official Archie symbol from [cartesia.ai/favicon.svg](https://www.cartesia.ai/favicon.svg) |
| `kimi.svg` | Kimi | `#FFFFFF` | Simple Icons `kimi`; white so official black reads on dark |
| `luma.svg` | Luma | Official facet colors | LobeHub `luma-color` (official stacked-facet logo) |
| `vercel.svg` | Vercel | `#FFFFFF` | Simple Icons `vercel` triangle; white so official black reads on dark |
| `railway.svg` | Railway | `#FFFFFF` | Simple Icons `railway`; white so official near-black reads on dark |
| `cloudflare.svg` | Cloudflare | `#F38020` | Simple Icons `cloudflare` |
| `render.svg` | Render | `#FFFFFF` | Simple Icons `render`; white so official black reads on dark |
| `fly.svg` | Fly.io | `#FFFFFF` | Simple Icons `flydotio`; white so official `#24175B` reads on dark |
| `netlify.svg` | Netlify | `#00C7B7` | Simple Icons `netlify` |
| `digitalocean.svg` | DigitalOcean | `#0080FF` | Simple Icons `digitalocean` |
| `google-cloud.svg` | Google Cloud | Official four-color | LobeHub `googlecloud-color` |
| `aws.svg` | AWS | Wordmark `#FFFFFF` + smile `#F90` | Official AWS smile + wordmark (LobeHub `aws-color` paths); white letters on dark |
| `azure.svg` | Azure | Official blues | LobeHub `azure-color` (official A-tile) |
| `heroku.svg` | Heroku | `#430098` | Simple Icons `heroku` path; Heroku purple |
| `linode.svg` | Linode | `#00A95C` | Simple Icons `linode` path; Linode green |
| `fastly.svg` | Fastly | `#FF282D` | Simple Icons `fastly` |
| `bunny.svg` | bunny.net | `#FFAA49` | Simple Icons `bunnydotnet` |
| `deno.svg` | Deno Deploy | `#FFFFFF` | Simple Icons `denodeploy`; white so official `#002633` reads on dark |
| `koyeb.svg` | Koyeb | `#FFFFFF` | Simple Icons `koyeb`; white so official `#121212` reads on dark |
| `modal.svg` | Modal | `#7FEE64` | Simple Icons `modal` |
| `firebase.svg` | Firebase | `#DD2C00` | Simple Icons `firebase` |

Rendered centered above the service name (`/logos/{id}.svg`) without a circular clip so the full mark stays visible.
