import type { ComponentType, ReactNode } from "react"
import { Outlet, useLocation } from "react-router"

import { Footer } from "~/components/footer"
import { Header } from "~/components/header"
import { ReceiverOverlay } from "~/components/receiver-overlay"
import { RemoteCommandListener } from "~/components/remote-command-listener"
import {
  isDocsRoutePathname,
  hasSaveGroupSearchParam,
  savePaths,
} from "~/lib/paths"

declare global {
  interface SiteLayoutContentProps {
    readonly pathname: string
    readonly search: string
    readonly children: ReactNode
    readonly HeaderComponent: ComponentType<{ showSaveAction: boolean }>
    readonly FooterComponent: ComponentType
    readonly RemoteCommandListenerComponent: ComponentType
    readonly ReceiverOverlayComponent: ComponentType
  }
}

export const SiteLayoutContent = ({
  pathname,
  search,
  children,
  HeaderComponent,
  FooterComponent,
  RemoteCommandListenerComponent,
  ReceiverOverlayComponent,
}: SiteLayoutContentProps) => {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/"
  const isDocsRoute = isDocsRoutePathname(normalizedPathname)
  const isSaveRoute = normalizedPathname === savePaths.root
  const isSaveFolderRoute = normalizedPathname.startsWith(
    savePaths.folderPrefix
  )
  // The gallery group view is a search-param route (/save?group=…) that
  // renders a fullscreen immersive layer. Chrome must drop with the route
  // itself, not with the client-side body attribute the fullscreen hook
  // sets after paint — otherwise server HTML and slow paints show the
  // footer as a stray bar below the immersive view.
  const isSaveGroupRoute = isSaveRoute && hasSaveGroupSearchParam(search)
  const isSaveImmersiveRoute = isSaveFolderRoute || isSaveGroupRoute

  return (
    <>
      <RemoteCommandListenerComponent />
      {!isSaveImmersiveRoute && (
        <HeaderComponent showSaveAction={!isSaveRoute} />
      )}
      <main
        data-site-content
        className={
          isSaveImmersiveRoute ? "flex-1 pt-0" : "flex-1 pt-14 md:pt-16"
        }
      >
        {children}
      </main>
      {!isDocsRoute && !isSaveImmersiveRoute && <FooterComponent />}
      <ReceiverOverlayComponent />
    </>
  )
}

const SiteLayout = () => {
  const location = useLocation()

  return (
    <SiteLayoutContent
      pathname={location.pathname}
      search={location.search}
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
