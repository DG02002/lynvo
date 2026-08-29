import { useEffect, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { CopyIcon, Tick02Icon } from "@hugeicons/core-free-icons"
import { showLinkCopiedToast } from "~/lib/toast-notifications"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import type { LinkViewItem } from "~/features/links/types"
import { getLinkViewItemMetadata } from "~/features/links/link-metadata-accessors"
import { highlightLogJson } from "./log-json-highlight"

interface LinkDebugLogDialogProps {
  readonly item: LinkViewItem | undefined
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

const LinkDebugLogDialog = ({
  item,
  open,
  onOpenChange,
}: LinkDebugLogDialogProps) => {
  const [didCopy, setDidCopy] = useState(false)
  const [highlightedLog, setHighlightedLog] = useState<string | undefined>()
  const debugLog = item ? getLinkViewItemMetadata(item).debugLog : undefined
  const hasLog = Boolean(debugLog && debugLog.length > 0)
  const serializedLog = JSON.stringify(
    {
      source: item?.url,
      title: item?.title ?? undefined,
      pluginServerId:
        item && getLinkViewItemMetadata(item).source.pluginServerId,
      communicationLog: debugLog ?? [],
    },
    null,
    2
  )

  useEffect(() => {
    if (!open || !hasLog) {
      setHighlightedLog(undefined)
      return
    }
    let cancelled = false
    void highlightLogJson(serializedLog).then((html) => {
      if (!cancelled) {
        setHighlightedLog(html)
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, hasLog, serializedLog])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(serializedLog)
      setDidCopy(true)
      showLinkCopiedToast()
      setTimeout(() => setDidCopy(false), 2_000)
    } catch {
      // Clipboard can be unavailable; the dialog itself stays selectable.
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="flex max-h-[85vh] w-full flex-col gap-4 p-6 data-[size=default]:max-w-[calc(100%-2rem)] sm:data-[size=default]:max-w-lg">
        <AlertDialogHeader className="w-full min-w-0 shrink-0">
          <AlertDialogTitle className="text-center text-xl font-normal sm:text-2xl">
            Log
          </AlertDialogTitle>
        </AlertDialogHeader>
        {hasLog ? (
          <div
            aria-label="Communication log in JSON format"
            className="log-json min-h-0 flex-1 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed"
          >
            {highlightedLog ? (
              // SAFETY: shiki output for our own JSON.stringify payload;
              // shiki escapes the code content, so nothing user-controlled
              // reaches the DOM as markup.
              <div dangerouslySetInnerHTML={{ __html: highlightedLog }} />
            ) : (
              <pre className="m-0 whitespace-pre-wrap break-all">
                {serializedLog}
              </pre>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No communication recorded yet.
          </p>
        )}
        <div className="flex w-full flex-col gap-3">
          <AlertDialogAction
            className="h-13.5 w-full"
            disabled={!hasLog}
            onClick={() => void handleCopy()}
          >
            <HugeiconsIcon icon={didCopy ? Tick02Icon : CopyIcon} />
            {didCopy ? "Copied" : "Copy log"}
          </AlertDialogAction>
          <AlertDialogCancel
            variant="outline"
            className="h-13.5 w-full border-muted-foreground/20"
          >
            Close
          </AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { LinkDebugLogDialog }
