import type { ComponentProps, FormEventHandler, ReactNode } from "react"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { DialogActionButton } from "~/components/dialog-action-button"
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"

interface FormDialogContentProps {
  title: ReactNode
  description: ReactNode
  media?: ReactNode
  children: ReactNode
  submitLabel: ReactNode
  onSubmit: FormEventHandler<HTMLFormElement>
  submitVariant?: ComponentProps<typeof Button>["variant"]
  submitDisabled?: boolean
  submitPending?: boolean
  cancelDisabled?: boolean
  cancelLabel?: ReactNode
}

export const FormDialogContent = ({
  title,
  description,
  media,
  children,
  submitLabel,
  onSubmit,
  submitVariant = "default",
  submitDisabled = false,
  submitPending = false,
  cancelDisabled = false,
  cancelLabel = "Cancel",
}: FormDialogContentProps) => (
  <DialogContent className="p-10" showCloseButton={false}>
    {media}
    <DialogHeader className="w-full items-center gap-4 text-center">
      <DialogTitle className="w-full px-0 text-center text-2xl font-normal leading-tight sm:px-10 sm:text-3xl">
        {title}
      </DialogTitle>
      <DialogDescription className="w-full text-center text-base text-muted-foreground">
        {description}
      </DialogDescription>
    </DialogHeader>
    <form onSubmit={onSubmit} className="flex min-w-0 flex-col gap-6">
      {children}
      <div className="flex w-full flex-col gap-3">
        <DialogActionButton
          type="submit"
          variant={submitVariant}
          disabled={submitDisabled || submitPending}
        >
          {submitPending && (
            <Spinner data-icon="inline-start" aria-hidden="true" />
          )}
          {submitLabel}
        </DialogActionButton>
        <DialogClose
          render={
            <DialogActionButton
              type="button"
              variant="secondary"
              disabled={cancelDisabled}
            />
          }
        >
          {cancelLabel}
        </DialogClose>
      </div>
    </form>
  </DialogContent>
)
