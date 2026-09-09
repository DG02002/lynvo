import { useCallback, useEffect, useRef, type ReactNode } from "react"
import { Outlet } from "react-router"
import { ThemeProvider } from "next-themes"
import { RemoteControlProvider } from "~/context/remote-control-context"
import { RealtimeProvider } from "~/context/realtime-context"
import { VersionWatcher } from "~/components/version-watcher"
import { PlayerLaunchErrorDialog } from "~/components/player-launch-error-dialog"
import { OpenedConfirmationDialog } from "~/components/opened-confirmation-dialog"
import { AppToaster } from "~/components/app-toaster"
import { NavigationProgress } from "~/components/navigation-progress"
import { TooltipProvider } from "~/components/ui/tooltip"
import { AuthActivityTouch } from "./auth-activity-touch"
import { ThemeCookieSync } from "./theme-cookie-sync"
import { AccountSettingsSynchronization } from "./account-settings-synchronization"
import { clearRevokedSessionState } from "./session-revocation"
import { PlayerPreferenceProvider } from "~/context/player-preference-context"
import { IdentitySynchronizer } from "./identity-synchronizer"
import { toProviderUser } from "./provider-user"
import { clearAsyncResourceCacheWhere } from "~/hooks/use-async-resource"
import { clearLinksSnapshotStores } from "~/features/links/use-links/links-store"
import { isSettingsDataCacheKeyForUser } from "~/features/site/settings/settings-data-cache"

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
      clearAsyncResourceCacheWhere((cacheKey) =>
        isSettingsDataCacheKeyForUser(cacheKey, previousId)
      )
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
          {(validateIdentity) => (
            <RealtimeProvider
              user={providerUser}
              onConnectionOpen={validateIdentity}
              onSessionRevoked={handleSessionRevoked}
            >
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
