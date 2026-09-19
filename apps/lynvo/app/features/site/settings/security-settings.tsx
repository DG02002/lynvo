import { Alert01Icon, ChevronRightIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import * as React from "react"

import { ConfirmationAlertDialog } from "~/components/confirmation-alert-dialog"
import { useAsyncResource } from "~/hooks/use-async-resource"
import { client } from "~/lib/api/client"
import { signOut } from "~/lib/session-http"
import {
  showErrorToast,
  showSuccessToast,
  showWarningToast,
} from "~/lib/toast-notifications"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"

import { ActiveSessionsView } from "./active-sessions-view"
import { DeleteAccountDialog } from "./delete-account-dialog"
import { settingsCopy } from "./settings-copy"
import { getSettingsDataCacheKey } from "./settings-data-cache"
import {
  SettingsPanel,
  SettingsList,
  SettingsActionRow,
  SettingsRowInfo,
} from "./settings-layout"

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
  const { data, reload } = useAsyncResource(
    () => client.settings.listSessions(),
    [user.id],
    { cacheKey: getSettingsDataCacheKey("security", user.id) }
  )
  const sessions = data ?? []
  const [deleteConfirmEmail, setDeleteConfirmEmail] = React.useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [revokeAllDialogOpen, setRevokeAllDialogOpen] = React.useState(false)
  const [busy, setBusy] = React.useState<string | null>(null)

  const handleRevokeAllSessions = async () => {
    setBusy("revokeAll")
    try {
      await client.settings.revokeAllSessions()
      await signOut()
      window.location.href = "/"
    } catch (error) {
      showErrorToast({
        title: "Couldn’t sign out of all sessions",
        description: getUserFacingErrorMessage(
          error,
          "The sessions couldn’t be signed out. Try again."
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
      await client.settings.deleteAccount({
        payload: { confirmEmail: deleteConfirmEmail },
      })
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
              await client.settings.revokeSession({
                params: { sessionId },
              })
              await reload()
            } catch (error) {
              showErrorToast({
                title: "Couldn’t sign out the session",
                description: getUserFacingErrorMessage(
                  error,
                  "The session couldn’t be signed out. Try again."
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
          title="Sign out of all sessions?"
          media={
            <HugeiconsIcon
              icon={Alert01Icon}
              className="mx-auto size-16 text-destructive"
            />
          }
          description={`This signs out every device, including this one. Unsaved work on those devices may be lost. ${settingsCopy.sessions.terminationDelay}`}
          confirmLabel="Sign out of all sessions"
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
              description="View all devices that have accessed your account. You can review active sessions, remove trusted devices, or use Sign out of all sessions to end all sessions."
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
