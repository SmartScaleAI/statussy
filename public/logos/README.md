# Provider logos

One static SVG per v0 provider. Filename = `Service.id` from `data/services.ts`.

Marks are simplified official silhouettes (same paths as SMA-8) with brand fills chosen for a dark board. Paths are original traces, not copied from a CDN.

| File                | Provider      | Fill                         | Source |
| ------------------- | ------------- | ---------------------------- | ------ |
| `openai.svg`        | OpenAI        | `#10A37F`                    | ChatGPT / OpenAI product green ([OpenAI brand](https://openai.com), commonly documented as ChatGPT green) |
| `anthropic.svg`     | Anthropic     | `#D4A27F`                    | Claude warm sand from [Anthropic](https://www.anthropic.com) product UI |
| `google-gemini.svg` | Google Gemini | `#4285F4` → `#9B72CB` → `#D96570` | Official Gemini sparkle gradient ([Google Gemini](https://gemini.google.com)) |
| `xai.svg`           | xAI           | `#FFFFFF`                    | Official mark is monochrome; white on dark per [x.ai](https://x.ai) |
| `mistral.svg`       | Mistral       | `#FA520F`                    | [Mistral](https://mistral.ai) brand orange (Simple Icons: `mistralai`) |
| `groq.svg`          | Groq          | `#F55036`                    | [Groq](https://groq.com) brand orange (Simple Icons: `groq`) |
| `perplexity.svg`    | Perplexity    | `#1FB8CD`                    | [Perplexity](https://www.perplexity.ai) teal (Simple Icons: `perplexity`) |
| `deepseek.svg`      | DeepSeek      | `#4D6BFE`                    | [DeepSeek](https://www.deepseek.com) brand blue (Simple Icons: `deepseek`) |
| `cohere.svg`        | Cohere        | `#D3FFCE`                    | [Cohere](https://cohere.com) mint (Simple Icons: `cohere`) |
| `openrouter.svg`    | OpenRouter    | `#6566F1`                    | [OpenRouter](https://openrouter.ai) indigo (Simple Icons: `openrouter`) |

Hex values for Groq, Perplexity, DeepSeek, Cohere, OpenRouter, and Mistral match [Simple Icons](https://simpleicons.org/) brand colors. Gemini uses Google’s published sparkle gradient instead of a single swatch. OpenAI and Anthropic use product brand tints that stay readable on dark UI (pure black official marks would not). xAI has no chromatic brand color; the official white mark is kept.

Rendered by `components/provider-logo.tsx` at 24×24 (`size-6`) on each provider card.
