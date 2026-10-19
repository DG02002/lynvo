import type { FormEventHandler, ReactNode } from "react"

import { FormDialogContent } from "~/components/form-dialog-content"
import type { Button } from "~/components/ui/button"

interface SettingsFormDialogShellProps {
  readonly title: ReactNode
  readonly description?: ReactNode
  readonly media?: ReactNode
  readonly submitLabel: ReactNode
  readonly submitPending: boolean
  readonly submitDisabled?: boolean
  readonly cancelDisabled?: boolean
  readonly cancelLabel?: ReactNode
  readonly submitVariant?: React.ComponentProps<typeof Button>["variant"]
  readonly onCancel: () => void
  readonly onSubmit: FormEventHandler<HTMLFormElement>
  readonly error?: ReactNode
  readonly children: ReactNode
}

export const SettingsFormDialogShell = ({
  title,
  description,
  media,
  submitLabel,
  submitPending,
  submitDisabled,
  cancelDisabled,
  cancelLabel,
  submitVariant,
  onCancel,
  onSubmit,
  error,
  children,
}: SettingsFormDialogShellProps) => (
  <FormDialogContent
    title={title}
    description={description ?? ""}
    media={media}
    onSubmit={onSubmit}
    submitLabel={submitLabel}
    submitPending={submitPending}
    submitDisabled={submitDisabled}
    cancelDisabled={cancelDisabled}
    cancelLabel={cancelLabel}
    submitVariant={submitVariant}
    onCancel={onCancel}
  >
    {children}
    {error}
  </FormDialogContent>
)
