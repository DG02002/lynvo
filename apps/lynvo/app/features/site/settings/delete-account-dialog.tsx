import * as React from "react"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"

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
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="font-normal text-destructive">
          Delete Account
        </DialogTitle>
        <DialogDescription className="space-y-2 mt-2">
          <p>
            This permanently removes your account and cannot be undone. All your
            data will be permanently deleted.
          </p>
          <p className="text-foreground font-medium">
            To confirm, please type your username:{" "}
            <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs select-all">
              {username}
            </span>
          </p>
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onDeleteAccount} className="space-y-4">
        <Input
          type="text"
          placeholder="Type your username"
          value={confirmUsername}
          onChange={(event) => onConfirmUsernameChange(event.target.value)}
          required
          className="w-full"
          autoComplete="off"
        />
        <DialogFooter className="flex sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy === "delete"}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="destructive"
            disabled={confirmUsername.trim() !== username || busy === "delete"}
          >
            {busy === "delete" ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
)
