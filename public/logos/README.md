# Provider logos

One static SVG per v0 provider. Filename = `Service.id` from `data/services.ts`.

Marks keep the SMA-8 paths and viewBoxes (same size/alignment). Fills use documented brand colors so they stay readable on the dark board. No animation, no CDN.

| File                | Provider      | Fill                         | Source |
| ------------------- | ------------- | ---------------------------- | ------ |
| `openai.svg`        | OpenAI        | `#10A37F`                    | ChatGPT / OpenAI accent green ([openai.com/brand](https://openai.com/brand/)) — official lockup is black/white; green is the chromatic brand color that reads on dark |
| `anthropic.svg`     | Anthropic     | `#D97757`                    | Claude Clay token from Anthropic’s public design system ([anthropic.com](https://www.anthropic.com)) |
| `google-gemini.svg` | Google Gemini | `#4285F4 → #9B72CB → #D96570` | Official Gemini sparkle gradient ([design.google/library/gemini-ai-visual-design](https://design.google/library/gemini-ai-visual-design)); same path, static fill only |
| `xai.svg`           | xAI           | `#FFFFFF`                    | Official dark-surface mark ([x.ai](https://x.ai)); xAI has no chromatic primary |
| `mistral.svg`       | Mistral       | `#FA520F`                    | [Simple Icons](https://simpleicons.org) `Mistral AI` hex, sourced from [chat.mistral.ai](https://chat.mistral.ai) |
| `groq.svg`          | Groq          | `#F55036`                    | Groq primary orange in public brand guidelines |
| `perplexity.svg`    | Perplexity    | `#1FB8CD`                    | [Simple Icons](https://simpleicons.org) `Perplexity` hex, sourced from [perplexity.ai](https://www.perplexity.ai) |
| `deepseek.svg`      | DeepSeek      | `#4D6BFE`                    | Official whale-mark blue (commonly published as DeepSeek Blue; Simple Icons lists nearby `#5786FE` from [deepseek.com](https://www.deepseek.com)) |
| `cohere.svg`        | Cohere        | `#FF7759`                    | Cohere Bittersweet accent from the Pentagram brand system — primary charcoal `#212121` fails on dark UI |
| `openrouter.svg`    | OpenRouter    | `#94A3B8`                    | [Simple Icons](https://simpleicons.org) `OpenRouter` hex, verified from [openrouter.ai](https://openrouter.ai) favicon |

Rendered by `components/provider-logo.tsx` in each `ServiceCard` header (`size-8`).
