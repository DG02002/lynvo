import type { Route } from "./+types/root"
import { initLogger } from "evlog"
import { evlog, useLogger as getRequestLogger } from "evlog/react-router"
import interLatinFontUrl from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url"
import jetBrainsMonoLatinFontUrl from "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url"
import "./app.css"
import { csrfCookie } from "~/lib/csrf"
import { getUserSession, responseWithSession } from "~/lib/auth"
import "~/global"
import { getServerEnv } from "~/lib/env.server"
import { getThemeFromCookieHeader } from "~/lib/theme"
import { AppProviders } from "./root/app-providers"
export { ErrorBoundary } from "./root/error-boundary"
export { Layout } from "./root/layout"

initLogger({
  env: { service: "lynvo" },
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
    rel: "preload",
    href: jetBrainsMonoLatinFontUrl,
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

export const loader = async (args: Route.LoaderArgs) => {
  getRequestLogger().set({ route: "root" })
  const request = args.request
  const env = getServerEnv(args.context)
  const cookieHeader = request.headers.get("Cookie")
  const csrfToken =
    (await csrfCookie.parse(cookieHeader)) || crypto.randomUUID()

  const sessionResult = await getUserSession(request, env)
  const data = {
    user: sessionResult.user,
    csrfToken,
    turnstileSiteKey: env.TURNSTILE_SITE_KEY,
    buildTime: __BUILD_TIME__,
    initialTheme: getThemeFromCookieHeader(cookieHeader),
  }

  return responseWithSession(data, sessionResult, request, {
    headers: {
      "Set-Cookie": await csrfCookie.serialize(csrfToken),
    },
  })
}

const App = ({ loaderData }: Route.ComponentProps) => {
  const { buildTime } = loaderData

  return <AppProviders buildTime={buildTime} user={loaderData.user} />
}

export default App
