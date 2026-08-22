import * as React from "react"
import { Alert01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { FormDialogContent } from "~/components/form-dialog-content"
import { FormDialogInput } from "~/components/form-dialog-input"
import { Field, FieldGroup } from "~/components/field"
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
}: DeleteAccountDialogProps) => (
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
          <span className="mt-3 block font-medium text-foreground">
            Enter this email address exactly to confirm:{" "}
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs select-all">
              {email}
            </span>
          </span>
        </>
      }
      onSubmit={onDeleteAccount}
      submitLabel={busy === "delete" ? "Deleting account…" : "Delete account"}
      submitVariant="destructive"
      submitDisabled={confirmEmail.trim() !== email || busy === "delete"}
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
          />
        </Field>
      </FieldGroup>
    </FormDialogContent>
  </Dialog>
)
