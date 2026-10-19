import type { ComponentProps, FormEventHandler, ReactNode } from "react"

import { DialogActionButton } from "~/components/dialog-action-button"
import { DialogHeroHeader } from "~/components/dialog-hero-header"
import { Spinner } from "~/components/spinner"
import type { Button } from "~/components/ui/button"
import { DialogClose, DialogContent } from "~/components/ui/dialog"

interface FormDialogContentProps {
  title: ReactNode
  description?: ReactNode
  media?: ReactNode
  children: ReactNode
  error?: ReactNode
  submitLabel: ReactNode
  onSubmit: FormEventHandler<HTMLFormElement>
  submitVariant?: ComponentProps<typeof Button>["variant"]
  submitDisabled?: boolean
  submitPending?: boolean
  cancelDisabled?: boolean
  cancelLabel?: ReactNode
  onCancel?: () => void
}

export const FormDialogContent = ({
  title,
  description = "",
  media,
  children,
  error,
  submitLabel,
  onSubmit,
  submitVariant = "default",
  submitDisabled = false,
  submitPending = false,
  cancelDisabled = false,
  cancelLabel = "Cancel",
  onCancel,
}: FormDialogContentProps) => (
  <DialogContent size="hero" showCloseButton={false}>
    {media}
    <DialogHeroHeader title={title} description={description} />
    <form onSubmit={onSubmit} className="flex min-w-0 flex-col gap-6">
      {children}
      {error}
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
              onClick={onCancel}
            />
          }
        >
          {cancelLabel}
        </DialogClose>
      </div>
    </form>
  </DialogContent>
)
