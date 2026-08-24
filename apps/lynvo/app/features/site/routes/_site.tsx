import { Outlet, useLocation } from "react-router"
import type { ComponentType, ReactNode } from "react"

import { Header } from "~/components/header"
import { Footer } from "~/components/footer"
import { LayoutGuideOverlay } from "~/components/layout-guide-overlay"
import { RemoteCommandListener } from "~/components/remote-command-listener"
import { ReceiverOverlay } from "~/components/receiver-overlay"
import { isSaveTitleDetailPath } from "~/features/links/title-grouping/title-group-href"
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
  const isSaveTitleDetailRoute = isSaveTitleDetailPath(normalizedPathname)
  const isSaveDebugSurface =
    isSaveRoute || isSaveFolderRoute || isSaveTitleDetailRoute
  const shouldShowLayoutGuide = useShouldShowLayoutGuide()

  return (
    <>
      <RemoteCommandListenerComponent />
      {!isSaveFolderRoute && !isSaveTitleDetailRoute && (
        <HeaderComponent showSaveAction={!isSaveRoute} />
      )}
      <main
        data-site-content
        className={
          isSaveFolderRoute || isSaveTitleDetailRoute
            ? "flex-1 pt-0"
            : "flex-1 pt-14 md:pt-16"
        }
      >
        {children}
      </main>
      {!isInnerDocsRoute && !isSaveFolderRoute && !isSaveTitleDetailRoute && (
        <FooterComponent />
      )}
      <ReceiverOverlayComponent />
      {isSaveDebugSurface && shouldShowLayoutGuide && (
        <LayoutGuideOverlay
          surface={isSaveTitleDetailRoute ? "fullscreen" : "save"}
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
