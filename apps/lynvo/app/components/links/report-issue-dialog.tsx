import { GithubIcon, TelegramIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import {
  buildGitHubIssueUrl,
  buildIssueReport,
  buildTelegramReportUrl,
} from "~/features/links/report-issue"
import type { LinkViewItem } from "~/features/links/types"

interface ReportIssueDialogProps {
  readonly item: LinkViewItem | undefined
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

const openReportUrl = (url: string): void => {
  window.open(url, "_blank", "noopener,noreferrer")
}

const ReportIssueDialog = ({
  item,
  open,
  onOpenChange,
}: ReportIssueDialogProps) => {
  const report = item && open ? buildIssueReport(item) : undefined
  const githubUrl = report ? buildGitHubIssueUrl(report) : undefined
  const telegramUrl = report ? buildTelegramReportUrl(report) : undefined

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-full data-[size=default]:max-w-[calc(100%-2rem)] sm:data-[size=default]:max-w-md">
        <AlertDialogHeader className="w-full min-w-0 place-items-center gap-4 text-center sm:place-items-center sm:text-center">
          <AlertDialogTitle className="w-full px-0 text-center text-2xl font-normal leading-tight sm:text-3xl">
            Report an issue
          </AlertDialogTitle>
          <AlertDialogDescription className="w-full min-w-0 text-pretty text-center text-base text-muted-foreground">
            Send a prefilled report to the Lynvo maintainers. It includes the
            Request ID and Extraction details from this Saved link, so the
            failure can be traced in server logs. You can review or edit the
            message before sending.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {report ? (
          <pre className="max-h-48 w-full overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
            {report.message}
          </pre>
        ) : null}
        <div className="flex w-full flex-col gap-3">
          <AlertDialogAction
            className="h-13.5 w-full"
            disabled={!githubUrl}
            onClick={() => {
              if (githubUrl) {
                openReportUrl(githubUrl)
              }
            }}
          >
            <HugeiconsIcon icon={GithubIcon} />
            Report on GitHub
          </AlertDialogAction>
          <AlertDialogAction
            variant="outline"
            className="h-13.5 w-full border-muted-foreground/20"
            disabled={!telegramUrl}
            onClick={() => {
              if (telegramUrl) {
                openReportUrl(telegramUrl)
              }
            }}
          >
            <HugeiconsIcon icon={TelegramIcon} />
            Report on Telegram
          </AlertDialogAction>
          <AlertDialogCancel
            variant="outline"
            className="h-13.5 w-full border-muted-foreground/20"
          >
            Cancel
          </AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { ReportIssueDialog }
