import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight02Icon } from "@hugeicons/core-free-icons"

import { ConfirmationAlertDialog } from "~/components/confirmation-alert-dialog"
import { HOME_DEMO_CLIPBOARD_URL } from "~/features/site/home/home-demo-constants"
import { cn } from "~/lib/utils"
import { ClipboardAccessIcon } from "./ClipboardAccessIcon"

interface ClipboardPermissionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAllow: () => Promise<void>
}

export function ClipboardPermissionDialog({
  open,
  onOpenChange,
  onAllow,
}: ClipboardPermissionDialogProps) {
  const [step, setStep] = React.useState(0)

  React.useEffect(() => {
    if (!open) {
      setStep(0)
      return
    }
    const interval = window.setInterval(
      () => setStep((current) => (current + 1) % 3),
      1900
    )
    return () => window.clearInterval(interval)
  }, [open])

  const handleAllow = async () => {
    await onAllow()
    onOpenChange(false)
  }

  const preview = (
    <div className="flex w-full flex-col items-center">
      <div
        className="relative -mx-10 -mt-10 w-[calc(100%+5rem)] overflow-hidden rounded-t-4xl bg-muted/35 px-6 py-10 shadow-[inset_0_-1px_rgba(0,0,0,0.08)] dark:bg-black/30 dark:shadow-[inset_0_-1px_rgba(255,255,255,0.08)]"
        aria-hidden="true"
      >
        <div className="flex flex-col gap-4">
          <div
            aria-hidden={step < 2}
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none",
              step >= 2
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0"
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="w-full rounded-md px-1 py-2 text-left">
                <span className="shimmer shimmer-color-blue-500/60 shimmer-duration-6000 shimmer-spread-24 block max-w-full truncate text-base font-normal text-primary">
                  {HOME_DEMO_CLIPBOARD_URL}
                </span>
              </div>
            </div>
          </div>

          <div
            className={`flex h-13.5 w-full items-center rounded-full border-2 bg-background/30 pl-5 pr-1 transition-colors duration-500 ${step >= 1 ? "border-blue-500" : "border-default-medium"}`}
          >
            <span className="flex-1 text-base text-muted-foreground">
              Paste link
            </span>
            <span className="flex size-11 items-center justify-center rounded-full bg-foreground/35 text-background">
              <HugeiconsIcon
                icon={ArrowRight02Icon}
                strokeWidth={2}
                className="size-6"
              />
            </span>
          </div>
        </div>

        <svg
          viewBox="0 0 28 28"
          className={`absolute z-10 size-6 drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)] transition-[left,top,opacity] duration-700 ease-out motion-reduce:hidden ${step === 0 ? "left-[78%] top-[75%] opacity-0" : step === 1 ? "left-[48%] top-[58%] opacity-100" : "left-[48%] top-[32%] opacity-0"}`}
        >
          <path
            d="M5 3.5 22.1 17l-8.4 1.2-4.6 7.1L5 3.5Z"
            fill="white"
            stroke="black"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <ClipboardAccessIcon className="mt-6 size-12" />
    </div>
  )

  return (
    <ConfirmationAlertDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Paste links faster"
      description="Allow clipboard access and Lynvo can spot a copied link and offer it above this input. Nothing is saved until you choose to save it."
      media={preview}
      confirmLabel="Allow clipboard access"
      cancelLabel="Not now"
      onConfirm={handleAllow}
    />
  )
}
