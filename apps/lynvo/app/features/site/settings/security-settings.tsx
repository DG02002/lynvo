import * as React from "react"
import { useAuthActions } from "@convex-dev/auth/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ChevronRightIcon } from "@hugeicons/core-free-icons"
import { useAction, useMutation, useQuery } from "convex/react"
import { toast } from "sonner"
import { api } from "../../../../convex/_generated/api"
import {
  SettingsPanel,
  SettingsList,
  SettingsActionRow,
  SettingsRowInfo,
} from "./settings-layout"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"
import { ActiveSessionsView } from "./active-sessions-view"
import { DeleteAccountDialog } from "./delete-account-dialog"
import { signOutWithWorkerSession } from "~/lib/worker-auth-session-http"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"

type SettingsUser = {
  id: string
  username: string
  sid: string
}

export function SecuritySettings({
  user,
  showActiveSessions,
  onShowActiveSessionsChange,
}: {
  user: SettingsUser
  showActiveSessions: boolean
  onShowActiveSessionsChange: (showActiveSessions: boolean) => void
}) {
  const { signOut } = useAuthActions()
  const sessions = useQuery(api.users.listSessions, {}) || []
  const revokeSession = useMutation(api.users.revokeSession)
  const revokeAllSessions = useMutation(api.users.revokeAllSessions)
  const deleteAccount = useAction(api.users.deleteAccount)
  const [deleteConfirmUsername, setDeleteConfirmUsername] = React.useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [revokeAllDialogOpen, setRevokeAllDialogOpen] = React.useState(false)
  const [busy, setBusy] = React.useState<string | null>(null)

  const handleRevokeAllSessions = async () => {
    setBusy("revokeAll")
    try {
      await revokeAllSessions()
      await signOutWithWorkerSession(signOut)
      window.location.href = "/"
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(
          error,
          "The sessions couldn’t be logged out. Try again."
        )
      )
    } finally {
      setBusy(null)
    }
  }

  const handleDeleteAccount = async (event: React.FormEvent) => {
    event.preventDefault()
    if (deleteConfirmUsername.trim() !== user.username) {
      toast.error(`Enter ${user.username} exactly.`)
      return
    }
    setBusy("delete")
    try {
      await deleteAccount({ confirmUsername: deleteConfirmUsername })
      await signOutWithWorkerSession(signOut)
      toast.success("Account deleted")
      window.location.href = "/"
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(
          error,
          "The account couldn’t be deleted. Try again."
        )
      )
    } finally {
      setBusy(null)
    }
  }

  if (showActiveSessions) {
    return (
      <>
        <ActiveSessionsView
          sessions={sessions}
          busy={busy}
          onBack={() => onShowActiveSessionsChange(false)}
          onRevokeSession={async (sessionIndex) => {
            try {
              await revokeSession({ sessionId: sessions[sessionIndex].id })
              toast.success("Session logged out")
            } catch (error) {
              toast.error(
                getUserFacingErrorMessage(
                  error,
                  "The session couldn’t be logged out. Try again."
                )
              )
            }
          }}
          onRevokeAllSessions={() => setRevokeAllDialogOpen(true)}
        />
        <AlertDialog
          open={revokeAllDialogOpen}
          onOpenChange={setRevokeAllDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Log out all sessions?</AlertDialogTitle>
              <AlertDialogDescription>
                This logs out every device, including this one. Unsaved work on
                those devices may be lost. Session termination may take up to 30
                minutes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AlertDialogCancel disabled={busy === "revokeAll"}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={busy === "revokeAll"}
                onClick={() => void handleRevokeAllSessions()}
              >
                {busy === "revokeAll" ? "Logging out…" : "Log out all sessions"}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </>
    )
  }

  return (
    <>
      <SettingsPanel>
        <SettingsList>
          <SettingsActionRow
            as="link"
            to="/auth/reset-password/new-password"
            className="hover:bg-transparent cursor-pointer select-none"
          >
            <SettingsRowInfo label="Password" />
            <div className="flex items-center gap-1.5 text-foreground">
              <span className="text-sm tracking-widest">••••••</span>
              <HugeiconsIcon icon={ChevronRightIcon} className="size-5" />
            </div>
          </SettingsActionRow>

          <SettingsActionRow
            onClick={() => onShowActiveSessionsChange(true)}
            className="hover:bg-transparent cursor-pointer select-none"
          >
            <SettingsRowInfo
              label="Active sessions"
              description="Review devices logged in to the account and end individual or all sessions."
            />
            <div className="flex items-center gap-1.5 shrink-0 text-foreground">
              <span className="text-sm font-normal">{sessions.length}</span>
              <HugeiconsIcon icon={ChevronRightIcon} className="size-5" />
            </div>
          </SettingsActionRow>

          <SettingsActionRow
            onClick={() => setDeleteDialogOpen(true)}
            className="hover:bg-transparent cursor-pointer select-none"
          >
            <SettingsRowInfo
              label="Delete account"
              description="This permanently removes your account and cannot be undone."
              destructive
            />
            <div className="flex items-center gap-1.5 shrink-0 text-destructive">
              <HugeiconsIcon icon={ChevronRightIcon} className="size-5" />
            </div>
          </SettingsActionRow>
        </SettingsList>
      </SettingsPanel>

      <DeleteAccountDialog
        username={user.username}
        busy={busy}
        open={deleteDialogOpen}
        confirmUsername={deleteConfirmUsername}
        onOpenChange={setDeleteDialogOpen}
        onConfirmUsernameChange={setDeleteConfirmUsername}
        onDeleteAccount={handleDeleteAccount}
      />
    </>
  )
}
