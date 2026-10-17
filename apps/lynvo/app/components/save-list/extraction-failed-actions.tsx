import { Bug01Icon, Delete02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

import { ReportIssueDialog } from "~/components/links/report-issue-dialog"
import { Button } from "~/components/ui/button"
import { linkCopy } from "~/features/links/link-copy"
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
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false)

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
          onClick={() => setIsReportDialogOpen(true)}
        >
          <HugeiconsIcon icon={Bug01Icon} />
          {linkCopy.actions.reportIssue}
        </Button>
      </span>
      <ReportIssueDialog
        item={item}
        open={isReportDialogOpen}
        onOpenChange={setIsReportDialogOpen}
      />
    </span>
  )
}
