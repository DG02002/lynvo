import {
  Links,
  Meta,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router"

import type { ComponentType, ReactNode } from "react"
import { CLIENT_PROFILE_BOOTSTRAP_SCRIPT } from "~/lib/client-profile"
import { THEME_BOOTSTRAP_SCRIPT } from "~/lib/theme"
import type { loader } from "../root"
import { RouteSeoMetadata } from "./route-seo-metadata"

declare global {
  interface DocumentLayoutProps {
    readonly children: ReactNode
    readonly csrfToken?: string
    readonly initialTheme?: string | null
    readonly user?: { readonly sub: string; readonly sid?: string } | null
    readonly LinksComponent: ComponentType<{ nonce: string }>
    readonly MetaComponent: ComponentType
    readonly ScriptsComponent: ComponentType
    readonly ScrollRestorationComponent: ComponentType
    readonly RouteSeoMetadataComponent: ComponentType
  }
}

export const DocumentLayout = ({
  children,
  csrfToken,
  initialTheme,
  user,
  LinksComponent,
  MetaComponent,
  ScriptsComponent,
  ScrollRestorationComponent,
  RouteSeoMetadataComponent,
}: DocumentLayoutProps) => {
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
        <script
          dangerouslySetInnerHTML={{
            __html: CLIENT_PROFILE_BOOTSTRAP_SCRIPT,
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        {csrfToken && <meta name="csrf-token" content={csrfToken} />}
        {user && <meta name="lynvo-user-id" content={user.sub} />}
        {user?.sid && <meta name="lynvo-session-id" content={user.sid} />}
        <RouteSeoMetadataComponent />
        <MetaComponent />
        <LinksComponent nonce="" />
      </head>
      <body className="h-full bg-background text-foreground antialiased flex flex-col min-h-screen">
        {children}
        <ScrollRestorationComponent />
        <ScriptsComponent />
      </body>
    </html>
  )
}

export const Layout = ({ children }: { children: ReactNode }) => {
  const loaderData = useRouteLoaderData<typeof loader>("root")
  return (
    <DocumentLayout
      csrfToken={loaderData?.csrfToken}
      initialTheme={loaderData?.initialTheme}
      user={loaderData?.user}
      LinksComponent={Links}
      MetaComponent={Meta}
      ScriptsComponent={Scripts}
      ScrollRestorationComponent={ScrollRestoration}
      RouteSeoMetadataComponent={RouteSeoMetadata}
    >
      {children}
    </DocumentLayout>
  )
}
