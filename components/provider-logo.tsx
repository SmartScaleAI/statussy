/**
 * Static marks for the v0 board. Files live in `public/logos/{service.id}.svg`.
 * Keep them small, monochrome or brand-tinted for dark UI — no animation.
 */
export function ProviderLogo({
  id,
  name,
}: {
  id: string
  name: string
}) {
  return (
    // Decorative: the row already shows the provider name.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/logos/${id}.svg`}
      alt=""
      width={24}
      height={24}
      className="size-6 shrink-0"
      aria-hidden="true"
      data-provider={id}
      title={name}
    />
  )
}
