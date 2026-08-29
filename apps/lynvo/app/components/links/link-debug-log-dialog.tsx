import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { CopyIcon, Tick02Icon } from "@hugeicons/core-free-icons"
import { showLinkCopiedToast } from "~/lib/toast-notifications"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import type { LinkViewItem } from "~/features/links/types"
import { getLinkViewItemMetadata } from "~/features/links/link-metadata-accessors"

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-xl flex-col gap-4 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Communication log</DialogTitle>
          <DialogDescription>
            Every Plugin Server exchange recorded for this link, newest last.
            Share this with the Plugin developer to debug failures without
            server logs. Credentials are never included.
          </DialogDescription>
        </DialogHeader>
        {debugLog && debugLog.length > 0 ? (
          <>
            <pre
              aria-label="Communication log in JSON format"
              className="min-h-0 flex-1 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-foreground"
            >
              {serializedLog}
            </pre>
            <Button
              type="button"
              variant="outline"
              className="self-end"
              onClick={() => void handleCopy()}
            >
              <HugeiconsIcon icon={didCopy ? Tick02Icon : CopyIcon} />
              {didCopy ? "Copied" : "Copy log"}
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No communication has been recorded for this link yet.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

export { LinkDebugLogDialog }
