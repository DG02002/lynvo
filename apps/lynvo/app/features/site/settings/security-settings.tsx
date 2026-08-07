import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Effect } from "effect"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert01Icon, ChevronRightIcon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import {
  SettingsPanel,
  SettingsList,
  SettingsActionRow,
  SettingsRowInfo,
} from "./settings-layout"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"
import { ActiveSessionsView } from "./active-sessions-view"
import { DeleteAccountDialog } from "./delete-account-dialog"
import { revokeWorkerSession } from "~/lib/worker-auth-session-http"
import { client } from "~/lib/effect/api/client"
import { ConfirmationAlertDialog } from "~/components/confirmation-alert-dialog"

type SettingsUser = {
  id: string
  username: string
  sid: string
}

const SECURITY_SESSIONS_QUERY_KEY = ["settings", "security", "sessions"]

export function SecuritySettings({
  user,
  showActiveSessions,
  onShowActiveSessionsChange,
}: {
  user: SettingsUser
  showActiveSessions: boolean
  onShowActiveSessionsChange: (showActiveSessions: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { data: sessions = [] } = useQuery({
    queryKey: SECURITY_SESSIONS_QUERY_KEY,
    queryFn: () => Effect.runPromise(client.settings.listSessions()),
  })
  const [deleteConfirmUsername, setDeleteConfirmUsername] = React.useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [revokeAllDialogOpen, setRevokeAllDialogOpen] = React.useState(false)
  const [busy, setBusy] = React.useState<string | null>(null)

  const handleRevokeAllSessions = async () => {
    setBusy("revokeAll")
    try {
      await Effect.runPromise(client.settings.revokeAllSessions())
      await revokeWorkerSession()
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
      await Effect.runPromise(
        client.settings.deleteAccount({
          payload: { confirmUsername: deleteConfirmUsername },
        })
      )
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
          onRevokeSession={async (sessionIndex) => {
            try {
              await Effect.runPromise(
                client.settings.revokeSession({
                  params: { sessionId: sessions[sessionIndex].id },
                })
              )
              await queryClient.invalidateQueries({
                queryKey: SECURITY_SESSIONS_QUERY_KEY,
              })
              toast.success("Session logged out")
            } catch (error) {
              toast.error(
                getUserFacingErrorMessage(
                  error,
                  "The session couldn’t be logged out. Try again."
                )
              )
              throw error
            }
          }}
          onRevokeAllSessions={() => setRevokeAllDialogOpen(true)}
        />
        <ConfirmationAlertDialog
          open={revokeAllDialogOpen}
          onOpenChange={setRevokeAllDialogOpen}
          title="Log out all sessions?"
          media={
            <HugeiconsIcon
              icon={Alert01Icon}
              className="mx-auto size-16 text-destructive"
            />
          }
          description="This logs out every device, including this one. Unsaved work on those devices may be lost. Session termination may take up to 30 minutes."
          confirmLabel={
            busy === "revokeAll" ? "Logging out…" : "Log out all sessions"
          }
          confirmVariant="destructive"
          disabled={busy === "revokeAll"}
          onConfirm={() => void handleRevokeAllSessions()}
        />
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
