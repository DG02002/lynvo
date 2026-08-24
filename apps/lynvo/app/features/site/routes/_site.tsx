import { Outlet, useLocation } from "react-router"
import type { ComponentType, ReactNode } from "react"

import { Header } from "~/components/header"
import { Footer } from "~/components/footer"
import { LayoutGuideOverlay } from "~/components/layout-guide-overlay"
import { RemoteCommandListener } from "~/components/remote-command-listener"
import { ReceiverOverlay } from "~/components/receiver-overlay"
import { useShouldShowLayoutGuide } from "../settings/layout-guide-preference"

declare global {
  interface SiteLayoutContentProps {
    readonly pathname: string
    readonly children: ReactNode
    readonly HeaderComponent: ComponentType<{ showSaveAction: boolean }>
    readonly FooterComponent: ComponentType
    readonly RemoteCommandListenerComponent: ComponentType
    readonly ReceiverOverlayComponent: ComponentType
  }
}

export const SiteLayoutContent = ({
  pathname,
  children,
  HeaderComponent,
  FooterComponent,
  RemoteCommandListenerComponent,
  ReceiverOverlayComponent,
}: SiteLayoutContentProps) => {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/"
  const isInnerDocsRoute = normalizedPathname.startsWith("/docs/")
  const isSaveRoute = normalizedPathname === "/save"
  const isSaveFolderRoute = normalizedPathname.startsWith("/save/folder/")
  const isSaveTitleRoute = normalizedPathname.startsWith("/save/title/")
  const isSaveDebugSurface =
    isSaveRoute || isSaveFolderRoute || isSaveTitleRoute
  const shouldShowLayoutGuide = useShouldShowLayoutGuide()

  return (
    <>
      <RemoteCommandListenerComponent />
      {!isSaveFolderRoute && !isSaveTitleRoute && (
        <HeaderComponent showSaveAction={!isSaveRoute} />
      )}
      <main
        data-site-content
        className={
          isSaveFolderRoute || isSaveTitleRoute
            ? "flex-1 pt-0"
            : "flex-1 pt-14 md:pt-16"
        }
      >
        {children}
      </main>
      {!isInnerDocsRoute && !isSaveFolderRoute && !isSaveTitleRoute && (
        <FooterComponent />
      )}
      <ReceiverOverlayComponent />
      {isSaveDebugSurface && shouldShowLayoutGuide && (
        <LayoutGuideOverlay
          surface={isSaveTitleRoute ? "fullscreen" : "save"}
        />
      )}
    </>
  )
}

const SiteLayout = () => {
  const location = useLocation()

  return (
    <SiteLayoutContent
      pathname={location.pathname}
      HeaderComponent={Header}
      FooterComponent={Footer}
      RemoteCommandListenerComponent={RemoteCommandListener}
      ReceiverOverlayComponent={ReceiverOverlay}
    >
      <Outlet />
    </SiteLayoutContent>
  )
}

export default SiteLayout
