import { ThemeProvider } from "next-themes"
import { useCallback, useEffect, useRef, type ReactNode } from "react"
import { Outlet } from "react-router"

import { AppToaster } from "~/components/app-toaster"
import { NavigationProgress } from "~/components/navigation-progress"
import { OpenedConfirmationDialog } from "~/components/opened-confirmation-dialog"
import { PlayerLaunchErrorDialog } from "~/components/player-launch-error-dialog"
import { TooltipProvider } from "~/components/ui/tooltip"
import { VersionWatcher } from "~/components/version-watcher"
import { PlayerPreferenceProvider } from "~/context/player-preference-context"
import { RealtimeProvider } from "~/context/realtime-context"
import { RemoteControlProvider } from "~/context/remote-control-context"
import { clearLinksSnapshotStores } from "~/features/links/use-links"
import { clearSettingsDataCacheForUser } from "~/features/site/settings/settings-data-cache"

import { AccountSettingsSynchronization } from "./account-settings-synchronization"
import { AuthActivityTouch } from "./auth-activity-touch"
import { IdentitySynchronizer } from "./identity-synchronizer"
import { toProviderUser } from "./provider-user"
import { clearRevokedSessionState } from "./session-revocation"
import { SettingsDataCacheSynchronization } from "./settings-data-cache-synchronization"
import { ThemeCookieSync } from "./theme-cookie-sync"

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
  const userId = providerUser?.id
  const previousUserId = useRef<string | undefined>(userId)
  const handleSessionRevoked = useCallback((revokedUserId: string) => {
    clearRevokedSessionState(localStorage, window.location, revokedUserId)
  }, [])

  useEffect(() => {
    const previousId = previousUserId.current
    if (previousId && previousId !== userId) {
      clearLinksSnapshotStores(previousId)
      clearSettingsDataCacheForUser(previousId)
    }
    previousUserId.current = userId
  }, [userId])

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      enableColorScheme
      disableTransitionOnChange
    >
      <TooltipProvider>
        <NavigationProgress />
        <ThemeCookieSync />
        <AuthActivityTouch isAuthenticated={Boolean(user)} />
        <IdentitySynchronizer user={providerUser}>
          {(ensureIdentityIsSafe) => (
            <RealtimeProvider
              user={providerUser}
              onConnectionOpen={() => void ensureIdentityIsSafe()}
              onSessionRevoked={handleSessionRevoked}
            >
              <SettingsDataCacheSynchronization userId={userId} />
              <PlayerPreferenceProvider
                key={userId ?? "signed-out"}
                userId={userId}
              >
                <AccountSettingsSynchronization userId={userId} />
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
        <AppToaster />
      </TooltipProvider>{" "}
    </ThemeProvider>
  )
}
