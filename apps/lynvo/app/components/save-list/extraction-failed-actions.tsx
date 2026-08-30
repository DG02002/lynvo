import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon, SourceCodeSquareIcon } from "@hugeicons/core-free-icons"
import { Button } from "~/components/ui/button"
import { LinkDebugLogDialog } from "~/components/links/link-debug-log-dialog"
import type { LinkViewItem } from "~/features/links/types"
import { cn } from "~/lib/utils"

interface ExtractionFailedActionsProps {
  readonly item: LinkViewItem
  readonly onDelete: () => void
  readonly className?: string
}

export const ExtractionFailedActions = ({
  item,
  onDelete,
  className,
}: ExtractionFailedActionsProps) => {
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false)

  return (
    <span
      className={cn("relative z-10 [&_button]:pointer-events-auto", className)}
    >
      <span className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDelete}>
          <HugeiconsIcon icon={Delete02Icon} />
          Delete
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsLogDialogOpen(true)}
        >
          <HugeiconsIcon icon={SourceCodeSquareIcon} />
          Log
        </Button>
      </span>
      <LinkDebugLogDialog
        item={item}
        open={isLogDialogOpen}
        onOpenChange={setIsLogDialogOpen}
      />
    </span>
  )
}
