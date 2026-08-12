import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight02Icon, AlertCircleIcon } from "@hugeicons/core-free-icons"

import { Spinner } from "~/components/ui/spinner"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "~/components/ui/input-group"
import { cn } from "~/lib/utils"
import { useClipboardUrl } from "./use-clipboard-url"
import { ClipboardPermissionDialog } from "./ClipboardPermissionDialog"
import { ClipboardAccessIcon } from "./ClipboardAccessIcon"
import { ExtractionSourceFlow } from "./extraction-source-flow"
import type { ExtractionPreview } from "~/features/links/use-link-actions/action-types"

const sourceStatusMessage = (status: string | undefined) => {
  if (status === "maintenance") {
    return "This Source is undergoing maintenance. Some links may be unavailable."
  }
  if (status === "degraded") {
    return "This Source is responding slowly. Some links may be unavailable."
  }
  if (status === "down") {
    return "This Source is temporarily unavailable. Try again later."
  }
  return undefined
}

const sourceStatusLabel = (status: string) => {
  if (status === "maintenance") {
    return "Maintenance"
  }
  if (status === "degraded") {
    return "Degraded"
  }
  if (status === "down") {
    return "Unavailable"
  }
  return "Status unavailable"
}

const getErrorTitle = (error: string, isExistingLinkWarning: boolean) => {
  if (isExistingLinkWarning) {
    return "Link already saved"
  }
  if (error.toLowerCase().includes("supported")) {
    return "Link not supported"
  }
  return "Link couldn’t be opened"
}

interface LinkInputSectionProps {
  url: string
  setUrl: (url: string) => void
  onSave: (url?: string) => void
  isSaving: boolean
  extractionPreview: ExtractionPreview | null
  error: string | null
  setError: (err: string | null) => void
  savedUrls?: ReadonlySet<string>
}

const EMPTY_SAVED_URLS = new Set<string>()

export function LinkInputSection({
  url,
  setUrl,
  onSave,
  isSaving,
  extractionPreview,
  error,
  setError,
  savedUrls = EMPTY_SAVED_URLS,
}: LinkInputSectionProps) {
  const [isClipboardDialogOpen, setIsClipboardDialogOpen] =
    React.useState(false)
  const isExistingLinkWarning = error === "Link already exists on your account."
  const {
    clipboardUrl,
    clipboardPermission,
    checkClipboard,
    requestClipboardAccess,
    pasteClipboardUrl,
    clearMatchedClipboardUrl,
  } = useClipboardUrl({
    currentUrl: url,
    savedUrls,
    setUrl,
    setError,
    onSave,
  })
  const statusMessage = sourceStatusMessage(
    extractionPreview?.meta.sourceStatus
  )

  return (
    <div className="w-full mx-auto mb-8 flex flex-col gap-4">
      <div
        aria-hidden={!clipboardUrl}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none",
          clipboardUrl
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <button
            type="button"
            className="w-full cursor-pointer rounded-md px-1 py-2 text-left"
            onClick={pasteClipboardUrl}
            tabIndex={clipboardUrl ? 0 : -1}
          >
            <span className="shimmer shimmer-color-blue-500/60 shimmer-duration-6000 shimmer-spread-24 block max-w-full truncate text-base font-normal text-primary">
              {clipboardUrl}
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 translate-y-0 opacity-100 transition-[opacity,transform] duration-200 starting:-translate-y-2 starting:opacity-0">
          <Alert
            variant={isExistingLinkWarning ? "default" : "destructive"}
            className={cn(
              isExistingLinkWarning &&
                "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
            )}
          >
            <HugeiconsIcon icon={AlertCircleIcon} />
            <AlertTitle>
              {getErrorTitle(error, isExistingLinkWarning)}
            </AlertTitle>
            {!isExistingLinkWarning && (
              <AlertDescription>{error}</AlertDescription>
            )}
          </Alert>
        </div>
      )}

      <label htmlFor="link-input" className="sr-only">
        Link
      </label>
      <InputGroup className="w-full h-13.5 rounded-full bg-muted/30 sm:flex-1 border-2 border-default-medium has-[[data-slot=input-group-control]:focus-visible]:border-2 has-[[data-slot=input-group-control]:focus-visible]:border-blue-500 has-[[data-slot=input-group-control]:focus-visible]:ring-0">
        <InputGroupInput
          id="link-input"
          placeholder="https://example.com/video"
          className="pl-5 text-base text-heading md:text-base"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            if (e.target.value === "") {
              setError(null)
            } else if (error) {
              setError(null)
            }
            clearMatchedClipboardUrl(e.target.value)
          }}
          onClick={checkClipboard}
          onFocus={checkClipboard}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSave()
            }
          }}
          aria-invalid={Boolean(error && !isExistingLinkWarning)}
        />
        <InputGroupAddon align="inline-end">
          {clipboardPermission !== "checking" &&
            clipboardPermission !== "granted" && (
              <InputGroupButton
                type="button"
                onClick={() => setIsClipboardDialogOpen(true)}
                size="icon-xs"
                title="Enable clipboard suggestions"
                aria-label="Enable clipboard suggestions"
                className="size-11 rounded-full bg-transparent hover:bg-transparent hover:text-inherit dark:hover:bg-transparent active:scale-[0.96]"
              >
                <ClipboardAccessIcon className="size-6" />
              </InputGroupButton>
            )}
          <InputGroupButton
            type="button"
            onClick={() => onSave()}
            disabled={isSaving || !url.trim()}
            size="icon-xs"
            title="Save link"
            aria-label="Save link"
            variant="default"
            className="size-11 rounded-full"
          >
            {isSaving ? (
              <Spinner className="size-6" aria-label="Saving link…" />
            ) : (
              <HugeiconsIcon
                icon={ArrowRight02Icon}
                strokeWidth={2}
                className="size-6"
              />
            )}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      <ClipboardPermissionDialog
        open={isClipboardDialogOpen}
        onOpenChange={setIsClipboardDialogOpen}
        onAllow={requestClipboardAccess}
      />

      {isSaving && extractionPreview && (
        <div className="flex flex-col gap-1 px-3 text-xs text-muted-foreground">
          <ExtractionSourceFlow
            meta={extractionPreview.meta}
            statusLabel={
              extractionPreview.meta.sourceStatus &&
              extractionPreview.meta.sourceStatus !== "active"
                ? sourceStatusLabel(extractionPreview.meta.sourceStatus)
                : undefined
            }
          />
          {statusMessage && (
            <span className="text-[11px] text-muted-foreground">
              {statusMessage}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
