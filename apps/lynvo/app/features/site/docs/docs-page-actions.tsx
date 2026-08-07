import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "~/components/ui/button"

export const DocsPageActions = ({ page }: { page: DocumentationPage }) => (
  <Button
    variant="secondary"
    size="lg"
    nativeButton={false}
    className="h-12 gap-2 rounded-full px-5 text-sm font-normal"
    render={
      <a href={page.markdownUrl} target="_blank" rel="noreferrer">
        <span>View Markdown</span>
        <HugeiconsIcon
          icon={ArrowUpRight01Icon}
          aria-hidden="true"
          className="size-4"
          strokeWidth={1.5}
        />
      </a>
    }
  />
)
