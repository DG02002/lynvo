import { Outlet, useLocation } from "react-router"

import { Header } from "~/components/Header"
import { Footer } from "~/components/Footer"
import { RemoteCommandListener } from "~/components/RemoteCommandListener"
import { ReceiverOverlay } from "~/components/ReceiverOverlay"

export default function SiteLayout() {
  const location = useLocation()
  const normalizedPathname = location.pathname.replace(/\/+$/, "") || "/"
  const isInnerDocsRoute = normalizedPathname.startsWith("/docs/")

  return (
    <>
      <RemoteCommandListener />
      <Header />
      <main data-site-content className="flex-1 pt-14 md:pt-16">
        <Outlet />
      </main>
      {!isInnerDocsRoute && <Footer />}
      <ReceiverOverlay />
    </>
  )
}
