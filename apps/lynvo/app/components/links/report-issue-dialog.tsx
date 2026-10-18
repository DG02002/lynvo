import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Bug01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

import { GitHubMark, TelegramMark } from "~/components/brand-marks"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { Button } from "~/components/ui/button"
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
  const [areDetailsVisible, setAreDetailsVisible] = useState(false)
  const report = item && open ? buildIssueReport(item) : undefined
  const githubUrl = report ? buildGitHubIssueUrl(report) : undefined
  const telegramUrl = report ? buildTelegramReportUrl(report) : undefined

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) {
          setAreDetailsVisible(false)
        }
      }}
    >
      <AlertDialogContent className="w-full data-[size=default]:max-w-[calc(100%-2rem)] sm:data-[size=default]:max-w-md">
        <AlertDialogHeader className="w-full min-w-0 place-items-center gap-4 text-center sm:place-items-center sm:text-center">
          <HugeiconsIcon
            icon={Bug01Icon}
            className="mx-auto size-16 text-muted-foreground"
          />
          <AlertDialogTitle className="w-full px-0 text-center text-2xl font-normal leading-tight sm:text-3xl">
            Report an issue
          </AlertDialogTitle>
          <AlertDialogDescription className="w-full min-w-0 text-pretty text-center text-base text-muted-foreground">
            The report is prefilled with this link’s failure details.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {report ? (
          <div className="flex w-full flex-col gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start text-muted-foreground"
              aria-expanded={areDetailsVisible}
              onClick={() => setAreDetailsVisible((isVisible) => !isVisible)}
            >
              <HugeiconsIcon
                icon={areDetailsVisible ? ArrowUp01Icon : ArrowDown01Icon}
              />
              {areDetailsVisible ? "Hide details" : "Show details"}
            </Button>
            {areDetailsVisible && (
              <dl className="flex max-h-56 w-full flex-col gap-2 overflow-auto rounded-lg border border-border/70 p-3">
                {report.details.map((detail) => (
                  <div
                    key={detail.label}
                    className="flex flex-col gap-0.5 sm:flex-row sm:gap-3"
                  >
                    <dt className="shrink-0 text-xs text-muted-foreground sm:w-28">
                      {detail.label}
                    </dt>
                    <dd className="min-w-0 break-all text-sm text-foreground">
                      {detail.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ) : null}
        <div className="flex w-full flex-col gap-3">
          <AlertDialogAction
            className="h-13.5 w-full bg-gradient-to-b from-[#2AABEE] to-[#229ED9] text-white hover:from-[#2AABEE] hover:to-[#229ED9]/90"
            disabled={!telegramUrl}
            onClick={() => {
              if (telegramUrl) {
                openReportUrl(telegramUrl)
              }
            }}
          >
            <TelegramMark className="size-5" />
            Report on Telegram
          </AlertDialogAction>
          <AlertDialogAction
            className="h-13.5 w-full bg-[#24292f] text-white hover:bg-[#24292f]/90"
            disabled={!githubUrl}
            onClick={() => {
              if (githubUrl) {
                openReportUrl(githubUrl)
              }
            }}
          >
            <GitHubMark className="size-5" />
            Report on GitHub
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
