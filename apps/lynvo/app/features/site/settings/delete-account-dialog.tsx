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
import { Label } from "~/components/ui/label"

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
          Delete account
        </DialogTitle>
        <DialogDescription className="space-y-2 mt-2">
          <p>
            This permanently deletes the account, saved links, settings, Plugin
            Server connections, credentials, and active sessions. This cannot be
            undone.
          </p>
          <p className="text-foreground font-medium">
            Enter this username exactly to confirm:{" "}
            <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs select-all">
              {username}
            </span>
          </p>
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onDeleteAccount} className="space-y-4">
        <Label htmlFor="delete-account-username">Username</Label>
        <Input
          id="delete-account-username"
          type="text"
          placeholder={username}
          value={confirmUsername}
          onChange={(event) => onConfirmUsernameChange(event.target.value)}
          required
          className="w-full"
          autoComplete="off"
          aria-describedby="delete-account-username-guidance"
        />
        <p
          id="delete-account-username-guidance"
          className="text-sm text-muted-foreground"
        >
          Enter {username} exactly.
        </p>
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
            {busy === "delete" ? "Deleting account…" : "Delete account"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
)
