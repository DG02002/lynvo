import { useCallback, useMemo, type ReactNode } from "react"
import { Outlet } from "react-router"
import { ThemeProvider } from "next-themes"
import { RemoteControlProvider } from "~/context/RemoteControlContext"
import { RealtimeProvider } from "~/context/RealtimeContext"
import { VersionWatcher } from "~/components/VersionWatcher"
import { PlayerLaunchErrorDialog } from "~/components/player-launch-error-dialog"
import { OpenedConfirmationDialog } from "~/components/opened-confirmation-dialog"
import { Toaster } from "~/components/ui/sonner"
import { AuthActivityTouch } from "./auth-activity-touch"
import { ThemeCookieSync } from "./theme-cookie-sync"
import { AccountSettingsSynchronization } from "./account-settings-synchronization"
import { clearRevokedSessionState } from "./session-revocation"
import { PlayerPreferenceProvider } from "~/context/player-preference-context"
import { IdentitySynchronizer } from "./identity-synchronizer"

interface AppProvidersProps {
  buildTime: string
  user: { sub: string; sid?: string } | null
  children?: ReactNode
}

export const AppProviders = ({
  buildTime,
  user,
  children,
}: AppProvidersProps) => {
  const providerUser = useMemo(
    () => (user ? { id: user.sub, sessionId: user.sid } : null),
    [user?.sid, user?.sub]
  )
  const handleSessionRevoked = useCallback((userId: string) => {
    clearRevokedSessionState(localStorage, window.location, userId)
  }, [])

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      enableColorScheme
      disableTransitionOnChange
    >
      <ThemeCookieSync />
      <AuthActivityTouch isAuthenticated={Boolean(user)} />
      <IdentitySynchronizer user={providerUser}>
        {(validateIdentity) => (
          <RealtimeProvider
            user={providerUser}
            onConnectionOpen={validateIdentity}
            onSessionRevoked={handleSessionRevoked}
          >
            <PlayerPreferenceProvider
              key={providerUser?.id ?? "signed-out"}
              userId={providerUser?.id}
            >
              <AccountSettingsSynchronization userId={providerUser?.id} />
              <RemoteControlProvider user={providerUser}>
                <VersionWatcher buildTime={buildTime} />
                {children ?? <Outlet />}
              </RemoteControlProvider>
            </PlayerPreferenceProvider>
          </RealtimeProvider>
        )}
      </IdentitySynchronizer>
      <PlayerLaunchErrorDialog />
      <OpenedConfirmationDialog />
      <Toaster />
    </ThemeProvider>
  )
}
