import { cn } from "@/lib/utils"

export function BrandLoader({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  return (
    <div className={cn("flex justify-center", className)} role="status">
      {/* Decorative: sr-only text is the accessible name. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/my-stack-loader.gif"
        alt=""
        width={32}
        height={32}
        className="size-8"
      />
      <span className="sr-only">{label}</span>
    </div>
  )
}
