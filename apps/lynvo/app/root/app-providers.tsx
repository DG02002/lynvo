import { useState, type ReactNode } from "react"
import { Outlet } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { RemoteControlProvider } from "~/context/RemoteControlContext"
import { RealtimeProvider } from "~/context/RealtimeContext"
import { VersionWatcher } from "~/components/VersionWatcher"
import { Toaster } from "~/components/ui/sonner"
import { AuthActivityTouch } from "./auth-activity-touch"
import { ThemeCookieSync } from "./theme-cookie-sync"
import { CookieConsent } from "~/components/cookie-consent"

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
        <RealtimeProvider user={providerUser}>
          <RemoteControlProvider user={providerUser}>
            <VersionWatcher buildTime={buildTime} />
            {children ?? <Outlet />}
            <CookieConsent />
          </RemoteControlProvider>
        </RealtimeProvider>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
