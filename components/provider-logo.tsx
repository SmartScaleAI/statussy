import { cn } from "@/lib/utils"

/**
 * Static marks for the v0 board. Files live in `public/logos/{service.id}.svg`.
 * Keep them small, monochrome or brand-tinted for dark UI — no animation.
 */
export function ProviderLogo({
  id,
  name,
  className,
}: {
  id: string
  name: string
  className?: string
}) {
  return (
    // Decorative: the card already shows the provider name.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/logos/${id}.svg`}
      alt=""
      width={24}
      height={24}
      className={cn("size-6 shrink-0", className)}
      aria-hidden="true"
      data-provider={id}
      title={name}
    />
  )
}
