# Service logos

One static SVG per v0 service. Filename = `Service.id` from `data/services.ts`.

Marks keep the SMA-8 paths and viewBoxes (same size/alignment). Fills use documented brand colors so they stay readable on the dark board. No animation, no CDN.

| File                | Service       | Fill                         | Source |
| ------------------- | ------------- | ---------------------------- | ------ |
| `openai.svg`        | OpenAI        | `#10A37F`                    | ChatGPT / OpenAI accent green ([openai.com/brand](https://openai.com/brand/)) — official lockup is black/white; green is the chromatic brand color that reads on dark |
| `anthropic.svg`     | Anthropic     | `#D97757`                    | Claude Clay token from Anthropic’s public design system ([anthropic.com](https://www.anthropic.com)) |
| `google-gemini.svg` | Google Gemini | `#4285F4 → #9B72CB → #D96570` | Official Gemini sparkle gradient ([design.google/library/gemini-ai-visual-design](https://design.google/library/gemini-ai-visual-design)); same path, static fill only |
| `xai.svg`           | xAI           | `#FFFFFF`                    | Official geometric x/A/I mark from [x.ai](https://x.ai) (Wikimedia / brand path); white on dark, no chromatic primary |
| `mistral.svg`       | Mistral       | `#FA520F`                    | [Simple Icons](https://simpleicons.org) `Mistral AI` hex, sourced from [chat.mistral.ai](https://chat.mistral.ai) |
| `groq.svg`          | Groq          | `#F55036`                    | Groq primary orange in public brand guidelines |
| `perplexity.svg`    | Perplexity    | `#1FB8CD`                    | [Simple Icons](https://simpleicons.org) `Perplexity` hex, sourced from [perplexity.ai](https://www.perplexity.ai) |
| `deepseek.svg`      | DeepSeek      | `#4D6BFE`                    | Official whale-mark blue (commonly published as DeepSeek Blue; Simple Icons lists nearby `#5786FE` from [deepseek.com](https://www.deepseek.com)) |
| `cohere.svg`        | Cohere        | `#FF7759`                    | Cohere Bittersweet accent from the Pentagram brand system — primary charcoal `#212121` fails on dark UI |
| `openrouter.svg`    | OpenRouter    | `#94A3B8`                    | [Simple Icons](https://simpleicons.org) `OpenRouter` hex, verified from [openrouter.ai](https://openrouter.ai) favicon |
| `fireworks.svg`     | Fireworks AI  | `#FF5A00`                    | Simple spark mark; Fireworks orange used on [fireworks.ai](https://fireworks.ai) |
| `together.svg`      | Together AI   | `#0B6BCB`                    | Simple linked-circles mark; Together blue from [together.ai](https://www.together.ai) |
| `cerebras.svg`      | Cerebras      | `#F15A24`                    | Simple wafer-C mark; Cerebras orange from [cerebras.ai](https://www.cerebras.ai) |
| `huggingface.svg`   | Hugging Face  | `#FFD21E`                    | [Simple Icons](https://simpleicons.org) `Hugging Face` path + yellow ([huggingface.co](https://huggingface.co)) |
| `replicate.svg`     | Replicate     | `#94A3B8`                    | [Simple Icons](https://simpleicons.org) `Replicate` stacked-R path; slate fill so the black official mark stays readable on dark |
| `runway.svg`        | Runway        | `#4F46E5`                    | Simple R mark; indigo stand-in (official lockup is black/white) |
| `ideogram.svg`      | Ideogram      | `#E11D8F`                    | Simple I / spark mark; Ideogram magenta from [ideogram.ai](https://ideogram.ai) |
| `stability.svg`     | Stability AI  | `#7C3AED`                    | Simple hex mark; Stability purple from [stability.ai](https://stability.ai) |
| `fal.svg`           | fal           | `#22C55E`                    | Simple chevron mark; green stand-in for [fal.ai](https://fal.ai) |
| `elevenlabs.svg`    | ElevenLabs    | `#A78BFA`                    | Two-bar 11 mark; violet stand-in (official lockup is black/white) |
| `minimax.svg`       | MiniMax       | `#EF4444`                    | Simple M mark; MiniMax red from [minimax.io](https://www.minimax.io) |
| `voyage.svg`        | Voyage AI     | `#2563EB`                    | Simple V mark; Voyage blue from [voyageai.com](https://www.voyageai.com) |
| `bfl.svg`           | Black Forest Labs | `#F59E0B`                | Simple hex mark; amber stand-in for FLUX / [bfl.ai](https://bfl.ai) |
| `cartesia.svg`      | Cartesia      | `#14B8A6`                    | Simple C / waveform mark; teal from [cartesia.ai](https://cartesia.ai) |
| `kimi.svg`          | Kimi          | `#38BDF8`                    | Simple K mark; Moonshot sky from [kimi.com](https://www.kimi.com) |
| `luma.svg`          | Luma          | `#E879F9`                    | Simple ring mark; Luma pink from [lumalabs.ai](https://lumalabs.ai) |

Rendered centered above the service name (`/logos/{id}.svg`) without a circular clip so the full mark stays visible.
