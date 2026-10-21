import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Bug01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

import { GitHubMark, TelegramMark } from "~/components/brand-marks"
import { AlertDialogHeroHeader } from "~/components/dialog-hero-header"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
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
      <AlertDialogContent size="hero" className="w-full">
        <AlertDialogHeroHeader
          icon={
            <HugeiconsIcon
              icon={Bug01Icon}
              className="mx-auto size-16 text-muted-foreground"
            />
          }
          title="Report an issue"
          description="The report is prefilled with this link’s failure details."
        />
        {report ? (
          <div className="flex w-full flex-col gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              aria-expanded={areDetailsVisible}
              onClick={() => setAreDetailsVisible((isVisible) => !isVisible)}
            >
              <HugeiconsIcon
                icon={areDetailsVisible ? ArrowUp01Icon : ArrowDown01Icon}
                className="text-muted-foreground"
              />
              <span className="text-muted-foreground">
                {areDetailsVisible ? "Hide details" : "Show details"}
              </span>
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
            variant="outline"
            // oxlint-disable-next-line shadcn/no-restyle -- Keep the neutral fill while removing the report action border.
            className="h-13.5 w-full border-0"
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
            variant="outline"
            // oxlint-disable-next-line shadcn/no-restyle -- Keep the neutral fill while removing the report action border.
            className="h-13.5 w-full border-0"
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
          <AlertDialogCancel className="h-13.5 w-full">
            Cancel
          </AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { ReportIssueDialog }
