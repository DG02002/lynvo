import * as React from "react"
import { Effect } from "effect"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert01Icon, ChevronRightIcon } from "@hugeicons/core-free-icons"
import {
  showErrorToast,
  showSuccessToast,
  showWarningToast,
} from "~/lib/toast-notifications"
import {
  SettingsPanel,
  SettingsList,
  SettingsActionRow,
  SettingsRowInfo,
} from "./settings-layout"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"
import { ActiveSessionsView } from "./active-sessions-view"
import { DeleteAccountDialog } from "./delete-account-dialog"
import { revokeSession } from "~/lib/session-http"
import { client } from "~/lib/effect/api/client"
import { ConfirmationAlertDialog } from "~/components/confirmation-alert-dialog"
import { useAsyncResource } from "~/hooks/use-async-resource"

type SettingsUser = {
  id: string
  email: string
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
  const { data, reload } = useAsyncResource(() =>
    Effect.runPromise(client.settings.listSessions())
  )
  const sessions = data ?? []
  const [deleteConfirmEmail, setDeleteConfirmEmail] = React.useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [revokeAllDialogOpen, setRevokeAllDialogOpen] = React.useState(false)
  const [busy, setBusy] = React.useState<string | null>(null)

  const handleRevokeAllSessions = async () => {
    setBusy("revokeAll")
    try {
      await Effect.runPromise(client.settings.revokeAllSessions())
      await revokeSession()
      window.location.href = "/"
    } catch (error) {
      showErrorToast({
        title: "Couldn’t log out all sessions",
        description: getUserFacingErrorMessage(
          error,
          "The sessions couldn’t be logged out. Try again."
        ),
      })
    } finally {
      setBusy(null)
    }
  }

  const handleDeleteAccount = async (event: React.FormEvent) => {
    event.preventDefault()
    if (deleteConfirmEmail.trim() !== user.email) {
      showWarningToast({
        title: "Email doesn’t match",
        description: `Enter ${user.email} exactly.`,
      })
      return
    }
    setBusy("delete")
    try {
      await Effect.runPromise(
        client.settings.deleteAccount({
          payload: { confirmEmail: deleteConfirmEmail },
        })
      )
      showSuccessToast({
        title: "Account deleted",
        description: "Your account has been permanently removed.",
      })
      window.location.href = "/"
    } catch (error) {
      showErrorToast({
        title: "Couldn’t delete the account",
        description: getUserFacingErrorMessage(
          error,
          "The account couldn’t be deleted. Try again."
        ),
      })
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
          onRevokeSession={async (sessionId) => {
            try {
              await Effect.runPromise(
                client.settings.revokeSession({
                  params: { sessionId },
                })
              )
              await reload()
            } catch (error) {
              showErrorToast({
                title: "Couldn’t log out the session",
                description: getUserFacingErrorMessage(
                  error,
                  "The session couldn’t be logged out. Try again."
                ),
              })
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
          confirmLabel="Log out all sessions"
          confirmVariant="destructive"
          pending={busy === "revokeAll"}
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
            onClick={() => onShowActiveSessionsChange(true)}
            className="hover:bg-transparent cursor-pointer select-none"
          >
            <SettingsRowInfo
              label="Active sessions"
              description="View all devices that have accessed your account. You can review active sessions, remove trusted devices, or use Log out all to end all sessions."
            />
            <div className="flex items-center gap-1.5 shrink-0 text-foreground">
              <span className="text-sm font-normal tabular-nums">
                {sessions.length}
              </span>
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
        email={user.email}
        busy={busy}
        open={deleteDialogOpen}
        confirmEmail={deleteConfirmEmail}
        onOpenChange={setDeleteDialogOpen}
        onConfirmEmailChange={setDeleteConfirmEmail}
        onDeleteAccount={handleDeleteAccount}
      />
    </>
  )
}
