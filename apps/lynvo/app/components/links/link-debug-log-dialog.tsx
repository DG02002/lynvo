import { useState, type ReactNode } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { CopyIcon, Tick02Icon } from "@hugeicons/core-free-icons"
import { showLinkCopiedToast } from "~/lib/toast-notifications"
import { Button } from "~/components/ui/button"
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

interface LinkDebugLogDialogProps {
  readonly item: LinkViewItem | undefined
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

const JSON_TOKEN_PATTERN =
  /("(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\btrue\b|\bfalse\b|\bnull\b|[{}\[\],:])/g

// The design system is monochrome, so highlighting differentiates by
// weight and shade rather than hue; every class reads in both themes.
const jsonTokenClassName = (token: string): string => {
  if (token.endsWith(":")) {
    return "font-medium text-foreground"
  }
  if (token.startsWith('"')) {
    return "text-foreground"
  }
  if (token === "true" || token === "false" || token === "null") {
    return "text-muted-foreground italic"
  }
  if (/^-?\d/.test(token)) {
    return "text-muted-foreground"
  }
  return "text-muted-foreground/60"
}

const renderHighlightedJson = (value: string): ReactNode[] =>
  value
    .split(JSON_TOKEN_PATTERN)
    .filter((segment) => segment !== "")
    .map((segment, index) => (
      <span key={index} className={jsonTokenClassName(segment)}>
        {segment}
      </span>
    ))

const LinkDebugLogDialog = ({
  item,
  open,
  onOpenChange,
}: LinkDebugLogDialogProps) => {
  const [didCopy, setDidCopy] = useState(false)
  const debugLog = item ? getLinkViewItemMetadata(item).debugLog : undefined
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
        {debugLog && debugLog.length > 0 ? (
          <pre
            aria-label="Communication log in JSON format"
            className="min-h-0 flex-1 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed"
          >
            {renderHighlightedJson(serializedLog)}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">
            No communication recorded yet.
          </p>
        )}
        <div className="flex w-full flex-col gap-3">
          <AlertDialogAction
            className="h-13.5 w-full"
            disabled={!(debugLog && debugLog.length > 0)}
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
