import { services } from "@/data/services"
import { cn } from "@/lib/utils"

/**
 * Static marks in `public/logos/`, named by `Service.id`.
 * Vendored from Lobe Icons (`@lobehub/icons-static-svg`, MIT).
 * Painted with `bg-foreground` + CSS mask so they inherit the dark Geist token.
 */
const LOGO_SRC: Record<string, string> = {
  openai: "/logos/openai.svg",
  anthropic: "/logos/anthropic.svg",
  "google-gemini": "/logos/google-gemini.svg",
  xai: "/logos/xai.svg",
  mistral: "/logos/mistral.svg",
  groq: "/logos/groq.svg",
  perplexity: "/logos/perplexity.svg",
  deepseek: "/logos/deepseek.svg",
  cohere: "/logos/cohere.svg",
  openrouter: "/logos/openrouter.svg",
}

const missingLogos = services
  .map((service) => service.id)
  .filter((id) => !LOGO_SRC[id])

if (missingLogos.length > 0) {
  throw new Error(`Missing provider logo for: ${missingLogos.join(", ")}`)
}

export function ProviderLogo({
  id,
  className,
}: {
  id: string
  className?: string
}) {
  const src = LOGO_SRC[id]

  if (!src) {
    return null
  }

  return (
    <span
      aria-hidden="true"
      className={cn("size-5 shrink-0 bg-foreground", className)}
      style={{
        maskImage: `url(${src})`,
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskImage: `url(${src})`,
        WebkitMaskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
      }}
    />
  )
}
