import { useCallback, useState, type ReactNode } from "react"
import { Outlet } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { RemoteControlProvider } from "~/context/RemoteControlContext"
import { RealtimeProvider } from "~/context/RealtimeContext"
import { VersionWatcher } from "~/components/VersionWatcher"
import { PlayerLaunchErrorDialog } from "~/components/player-launch-error-dialog"
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

const toProviderUser = (user: AppProvidersProps["user"]) =>
  user ? { id: user.sub, sessionId: user.sid } : null

export const AppProviders = ({
  buildTime,
  user,
  children,
}: AppProvidersProps) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  )

  const providerUser = toProviderUser(user)
  const handleSessionRevoked = useCallback(
    (userId: string) => {
      clearRevokedSessionState(
        queryClient,
        localStorage,
        window.location,
        userId
      )
    },
    [queryClient]
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        enableColorScheme
        disableTransitionOnChange
      >
        <ThemeCookieSync />
        <AuthActivityTouch isAuthenticated={Boolean(user)} />
        <IdentitySynchronizer user={providerUser} queryClient={queryClient}>
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
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
