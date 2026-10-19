import { useRef, type ReactNode } from "react"

import { AlertDialogHeroHeader } from "~/components/dialog-hero-header"
import { Spinner } from "~/components/spinner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
} from "~/components/ui/alert-dialog"
import type { Button } from "~/components/ui/button"

interface ConfirmationAlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description: ReactNode
  media?: ReactNode
  confirmLabel: ReactNode
  onConfirm: () => void
  cancelLabel?: ReactNode | null
  confirmVariant?: React.ComponentProps<typeof Button>["variant"]
  disabled?: boolean
  pending?: boolean
}

export function ConfirmationAlertDialog({
  open,
  onOpenChange,
  title,
  description,
  media,
  confirmLabel,
  onConfirm,
  cancelLabel = "Cancel",
  confirmVariant = "default",
  disabled = false,
  pending = false,
}: ConfirmationAlertDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent initialFocus={cancelRef} size="hero">
        {media}
        <AlertDialogHeroHeader
          title={title}
          description={description}
          descriptionClassName="break-words"
        />
        <div className="mt-4 flex w-full flex-col gap-3">
          <AlertDialogAction
            size="lg"
            className="h-13.5 w-full"
            variant={confirmVariant}
            disabled={disabled || pending}
            onClick={onConfirm}
          >
            {pending && <Spinner data-icon="inline-start" aria-hidden="true" />}
            {confirmLabel}
          </AlertDialogAction>
          {cancelLabel !== null && (
            <AlertDialogCancel
              ref={cancelRef}
              size="lg"
              className="h-13.5 w-full"
              disabled={disabled || pending}
            >
              {cancelLabel}
            </AlertDialogCancel>
          )}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
