import * as React from "react"
import { Alert01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { FormDialogContent } from "~/components/form-dialog-content"
import { FormDialogInput } from "~/components/form-dialog-input"
import { Field, FieldGroup } from "~/components/field"
import { Dialog } from "~/components/ui/dialog"

interface DeleteAccountDialogProps {
  username: string
  busy: string | null
  open: boolean
  confirmUsername: string
  onOpenChange: (open: boolean) => void
  onConfirmUsernameChange: (value: string) => void
  onDeleteAccount: (event: React.FormEvent) => void
}

export const DeleteAccountDialog = ({
  username,
  busy,
  open,
  confirmUsername,
  onOpenChange,
  onConfirmUsernameChange,
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
            Enter this username exactly to confirm:{" "}
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs select-all">
              {username}
            </span>
          </span>
        </>
      }
      onSubmit={onDeleteAccount}
      submitLabel={busy === "delete" ? "Deleting account…" : "Delete account"}
      submitVariant="destructive"
      submitDisabled={confirmUsername.trim() !== username || busy === "delete"}
      cancelDisabled={busy === "delete"}
    >
      <FieldGroup className="gap-4">
        <Field className="gap-1.5">
          <FormDialogInput
            id="delete-account-username"
            label="Type username to confirm"
            tone="destructive"
            type="text"
            value={confirmUsername}
            onChange={(event) => onConfirmUsernameChange(event.target.value)}
            required
            autoComplete="off"
          />
        </Field>
      </FieldGroup>
    </FormDialogContent>
  </Dialog>
)
