import type { ReactNode } from "react"
import { Spinner } from "~/components/ui/spinner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
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
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="p-10 data-[size=default]:max-w-[calc(100%-2rem)] sm:data-[size=default]:max-w-md">
        {media}
        <AlertDialogHeader className="w-full min-w-0 place-items-center gap-4 text-center sm:place-items-center sm:text-center">
          <AlertDialogTitle className="w-full px-0 text-center text-2xl font-normal leading-tight sm:px-10 sm:text-3xl">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="w-full min-w-0 break-words text-pretty text-center text-base text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
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
              variant="outline"
              size="lg"
              className="h-13.5 w-full border-muted-foreground/20"
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
