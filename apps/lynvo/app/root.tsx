import type { Route } from "./+types/root"
import type { ShouldRevalidateFunction } from "react-router"
import { initLogger } from "evlog"
import { evlog, useLogger as getRequestLogger } from "evlog/react-router"
import interLatinFontUrl from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url"
import "./app.css"
import "~/features/links/media-artwork/media-artwork-types"
import { csrfCookie } from "~/lib/csrf"
import { getUserSession, responseWithSession } from "~/lib/auth"
import "~/global"
import { getServerEnv } from "~/lib/env.server"
import { getThemeFromCookieHeader } from "~/lib/theme"
import { getMediaViewFromCookieHeader } from "~/features/site/settings/media-view-preference"
import { AppProviders } from "./root/app-providers"
import { shouldRevalidateRoot } from "./root/root-revalidation"
export { ErrorBoundary } from "./root/error-boundary"
export { Layout } from "./root/layout"

initLogger({
  env: { service: "lynvo" },
  sampling: {
    rates: { info: 10, warn: 100, error: 100 },
    keep: [{ status: 400 }],
  },
})

export const middleware: Route.MiddlewareFunction[] = [evlog()]

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  {
    rel: "preload",
    href: interLatinFontUrl,
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  },
  {
    rel: "apple-touch-icon",
    href: "/icons/brand/logo-180x180.png",
    sizes: "180x180",
    type: "image/png",
  },
  { rel: "manifest", href: "/site.webmanifest" },
]

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const startedAt = performance.now()
  const requestLogger = getRequestLogger()
  requestLogger.set({ route: "root" })
  const env = getServerEnv(context)
  const cookieHeader = request.headers.get("Cookie")
  const csrfToken =
    (await csrfCookie.parse(cookieHeader)) || crypto.randomUUID()

  const sessionStartedAt = performance.now()
  const sessionResult = await getUserSession(request, env)
  const sessionDurationMs = Math.max(0, performance.now() - sessionStartedAt)
  const data = {
    user: sessionResult.user,
    csrfToken,
    buildTime: __BUILD_TIME__,
    initialTheme: getThemeFromCookieHeader(cookieHeader),
    mediaView: getMediaViewFromCookieHeader(cookieHeader) ?? "hybrid",
  }

  requestLogger.set({
    navigation: {
      loader: "root",
      session_resolution_ms: sessionDurationMs,
      loader_duration_ms: Math.max(0, performance.now() - startedAt),
    },
  })
  return responseWithSession({
    responseData: data,
    sessionResult,
    request,
    init: {
      headers: {
        "Set-Cookie": await csrfCookie.serialize(csrfToken),
        "Server-Timing": `root-session;dur=${sessionDurationMs.toFixed(1)}`,
      },
    },
  })
}

export const shouldRevalidate: ShouldRevalidateFunction = (args) =>
  shouldRevalidateRoot(args)

const App = ({ loaderData }: Route.ComponentProps) => {
  const { buildTime } = loaderData

  return <AppProviders buildTime={buildTime} user={loaderData.user} />
}

export default App
