import { Outlet, useLocation } from "react-router"

import { Header } from "~/components/Header"
import { Footer } from "~/components/Footer"
import { RemoteCommandListener } from "~/components/RemoteCommandListener"
import { ReceiverOverlay } from "~/components/ReceiverOverlay"

export default function SiteLayout() {
  const location = useLocation()
  const normalizedPathname = location.pathname.replace(/\/+$/, "") || "/"
  const isInnerDocsRoute = normalizedPathname.startsWith("/docs/")
  const isSaveFolderRoute = normalizedPathname.startsWith("/save/folder/")

  return (
    <>
      <RemoteCommandListener />
      {!isSaveFolderRoute && <Header />}
      <main
        data-site-content
        className={isSaveFolderRoute ? "flex-1 pt-0" : "flex-1 pt-14 md:pt-16"}
      >
        <Outlet />
      </main>
      {!isInnerDocsRoute && !isSaveFolderRoute && <Footer />}
      <ReceiverOverlay />
    </>
  )
}
