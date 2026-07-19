import { useState, type ReactNode } from "react"
import { Outlet } from "react-router"
import { ConvexAuthProvider } from "@convex-dev/auth/react"
import { ConvexReactClient } from "convex/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { RemoteControlProvider } from "~/context/RemoteControlContext"
import { RealtimeProvider } from "~/context/RealtimeContext"
import { VersionWatcher } from "~/components/VersionWatcher"
import { cookieSyncedAuthStorage } from "~/lib/convex-auth-storage"
import { AuthActivityTouch } from "./auth-activity-touch"
import { ThemeCookieSync } from "./theme-cookie-sync"

interface AppProvidersProps {
  convexUrl: string
  buildTime: string
  user: { sub: string; sid?: string } | null
  children?: ReactNode
}

const toProviderUser = (user: AppProvidersProps["user"]) =>
  user ? { id: user.sub, sessionId: user.sid } : null

export const AppProviders = ({
  convexUrl,
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

  const [convexClient] = useState(() => new ConvexReactClient(convexUrl))
  const providerUser = toProviderUser(user)

  return (
    <ConvexAuthProvider
      client={convexClient}
      storage={cookieSyncedAuthStorage}
      storageNamespace="lynvo"
      shouldHandleCode={false}
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          enableColorScheme
          disableTransitionOnChange
        >
          <ThemeCookieSync />
          <AuthActivityTouch />
          <RealtimeProvider user={providerUser}>
            <RemoteControlProvider user={providerUser}>
              <VersionWatcher buildTime={buildTime} />
              {children ?? <Outlet />}
            </RemoteControlProvider>
          </RealtimeProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ConvexAuthProvider>
  )
}
