import { SuggestProviderForm } from "@/components/suggest-provider-form"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 pb-10",
        className
      )}
    >
      <Separator />
      <SuggestProviderForm />
      <p className="text-xs text-muted-foreground">
        live status from Postgres · mock fallback for unfetched providers
      </p>
    </footer>
  )
}
