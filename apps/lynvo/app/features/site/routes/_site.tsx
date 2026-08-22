import { Outlet, useLocation } from "react-router"

import { Header } from "~/components/header"
import { Footer } from "~/components/footer"
import { RemoteCommandListener } from "~/components/remote-command-listener"
import { ReceiverOverlay } from "~/components/receiver-overlay"

const SiteLayout = () => {
  const location = useLocation()
  const normalizedPathname = location.pathname.replace(/\/+$/, "") || "/"
  const isInnerDocsRoute = normalizedPathname.startsWith("/docs/")
  const isSaveRoute = normalizedPathname === "/save"
  const isSaveFolderRoute = normalizedPathname.startsWith("/save/folder/")

  return (
    <>
      <RemoteCommandListener />
      {!isSaveFolderRoute && <Header showSaveAction={!isSaveRoute} />}
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

export default SiteLayout
