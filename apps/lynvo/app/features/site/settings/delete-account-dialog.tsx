import { Alert01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import * as React from "react"

import { Field, FieldGroup } from "~/components/field"
import { FormDialogContent } from "~/components/form-dialog-content"
import { FormDialogInput } from "~/components/form-dialog-input"
import { Dialog } from "~/components/ui/dialog"

interface DeleteAccountDialogProps {
  email: string
  busy: string | null
  open: boolean
  confirmEmail: string
  onOpenChange: (open: boolean) => void
  onConfirmEmailChange: (value: string) => void
  onDeleteAccount: (event: React.FormEvent) => void
}

export const DeleteAccountDialog = ({
  email,
  busy,
  open,
  confirmEmail,
  onOpenChange,
  onConfirmEmailChange,
  onDeleteAccount,
}: DeleteAccountDialogProps) => {
  const confirmEmailHintId = React.useId()
  const isConfirmEmailInvalid =
    confirmEmail.length > 0 && confirmEmail.trim() !== email

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogContent
        title="Delete account"
        media={
          <HugeiconsIcon
            icon={Alert01Icon}
            className="mx-auto size-16 text-destructive"
          />
        }
        description={
          <>
            This permanently deletes the account, saved links, settings, Plugin
            Server connections, credentials, and active sessions. This cannot be
            undone.
            <span
              id={confirmEmailHintId}
              className="mt-3 block font-medium text-foreground"
            >
              Enter this email address exactly to confirm:{" "}
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs select-all">
                {email}
              </span>
            </span>
          </>
        }
        onSubmit={onDeleteAccount}
        submitLabel="Delete account"
        submitVariant="destructive"
        submitPending={busy === "delete"}
        submitDisabled={!confirmEmail || isConfirmEmailInvalid}
        cancelDisabled={busy === "delete"}
      >
        <FieldGroup className="gap-4">
          <Field className="gap-1.5">
            <FormDialogInput
              id="delete-account-email"
              label="Type your email address to confirm"
              tone="destructive"
              type="email"
              value={confirmEmail}
              onChange={(event) => onConfirmEmailChange(event.target.value)}
              required
              autoComplete="off"
              aria-invalid={isConfirmEmailInvalid}
              aria-describedby={
                isConfirmEmailInvalid ? confirmEmailHintId : undefined
              }
            />
          </Field>
        </FieldGroup>
      </FormDialogContent>
    </Dialog>
  )
}
