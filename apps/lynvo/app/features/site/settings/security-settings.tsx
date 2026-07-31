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
  const [busy, setBusy] = React.useState<string | null>(null)

  const handleRevokeAllSessions = async () => {
    if (
      !window.confirm(
        "Are you sure you want to log out of all active sessions across all devices? This will also log you out of your current session."
      )
    ) {
      return
    }
    setBusy("revokeAll")
    try {
      await revokeAllSessions()
      await signOutWithWorkerSession(signOut)
      window.location.href = "/"
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(
          error,
          "Unable to log out of all sessions. Try again."
        )
      )
    } finally {
      setBusy(null)
    }
  }

  const handleDeleteAccount = async (event: React.FormEvent) => {
    event.preventDefault()
    if (deleteConfirmUsername.trim() !== user.username) {
      toast.error("Username does not match")
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
          "Unable to delete the account. Try again."
        )
      )
    } finally {
      setBusy(null)
    }
  }

  if (showActiveSessions) {
    return (
      <ActiveSessionsView
        sessions={sessions}
        busy={busy}
        onBack={() => onShowActiveSessionsChange(false)}
        onRevokeSession={async (sessionIndex) => {
          await revokeSession({ sessionId: sessions[sessionIndex].id })
        }}
        onRevokeAllSessions={handleRevokeAllSessions}
      />
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
              description="View all devices that have accessed your account. You can review active sessions, remove trusted devices, or use Log out all to end all sessions."
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
