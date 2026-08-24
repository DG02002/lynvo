import { useCallback, type ReactNode } from "react"
import { Outlet } from "react-router"
import { ThemeProvider } from "next-themes"
import { RemoteControlProvider } from "~/context/remote-control-context"
import { RealtimeProvider } from "~/context/realtime-context"
import { VersionWatcher } from "~/components/version-watcher"
import { PlayerLaunchErrorDialog } from "~/components/player-launch-error-dialog"
import { OpenedConfirmationDialog } from "~/components/opened-confirmation-dialog"
import { Toaster } from "~/components/ui/sonner"
import { TooltipProvider } from "~/components/ui/tooltip"
import { AuthActivityTouch } from "./auth-activity-touch"
import { ThemeCookieSync } from "./theme-cookie-sync"
import { AccountSettingsSynchronization } from "./account-settings-synchronization"
import { clearRevokedSessionState } from "./session-revocation"
import { PlayerPreferenceProvider } from "~/context/player-preference-context"
import { IdentitySynchronizer } from "./identity-synchronizer"
import { toProviderUser } from "./provider-user"

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
  const providerUser = toProviderUser(user)
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
      <TooltipProvider>
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
      </TooltipProvider>
    </ThemeProvider>
  )
}
