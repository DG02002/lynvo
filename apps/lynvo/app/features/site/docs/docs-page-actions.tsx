import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

export const DocsPageActions = ({ page }: { page: DocumentationPage }) => (
  <a
    href={page.markdownUrl}
    target="_blank"
    rel="noreferrer"
    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-foreground/15 bg-background px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
  >
    <span>View Markdown</span>
    <HugeiconsIcon
      icon={ArrowUpRight01Icon}
      aria-hidden="true"
      className="size-3.5"
      strokeWidth={1.5}
    />
  </a>
)
