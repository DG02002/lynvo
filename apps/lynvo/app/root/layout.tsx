import {
  Links,
  Meta,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router"

import type * as React from "react"
import { THEME_BOOTSTRAP_SCRIPT } from "~/lib/theme"
import type { loader } from "../root"
import { RouteSeoMetadata } from "./route-seo-metadata"

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const loaderData = useRouteLoaderData<typeof loader>("root")
  const csrfToken = loaderData?.csrfToken
  const turnstileSiteKey = loaderData?.turnstileSiteKey
  const initialTheme = loaderData?.initialTheme
  const user = loaderData?.user
  const initialBackground = initialTheme === "dark" ? "#000" : "#fff"

  return (
    <html
      lang="en"
      className={initialTheme === "dark" ? "h-full dark" : "h-full"}
      style={{
        colorScheme: initialTheme ?? undefined,
        backgroundColor: initialTheme ? initialBackground : undefined,
      }}
      suppressHydrationWarning
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        {csrfToken && <meta name="csrf-token" content={csrfToken} />}
        {user && <meta name="lynvo-user-id" content={user.sub} />}
        {user?.sid && <meta name="lynvo-session-id" content={user.sid} />}
        {turnstileSiteKey && (
          <meta name="turnstile-site-key" content={turnstileSiteKey} />
        )}
        <RouteSeoMetadata />
        <Meta />
        <Links nonce="" />
      </head>
      <body className="h-full bg-background text-foreground antialiased flex flex-col min-h-screen">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
