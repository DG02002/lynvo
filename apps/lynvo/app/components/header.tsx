import { useLocation, useNavigate, useRouteLoaderData } from "react-router"
import { LogoLink } from "~/components/logo"
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { Switch } from "~/components/ui/switch"
import {
  setShouldUseLibraryMediaView,
  useShouldUseLibraryMediaView,
} from "~/features/site/settings/library-media-view-preference"
import {
  setShouldShowLayoutGuide,
  useShouldShowLayoutGuide,
} from "~/features/site/settings/layout-guide-preference"
import { useState } from "react"
import { GuestNavActions } from "./header/guest-nav-actions"
import { LogoutDialog } from "./header/logout-dialog"
import { UserNavActions } from "./header/user-nav-actions"
import { signOut } from "~/lib/session-http"

export const Header = ({ showSaveAction }: { showSaveAction: boolean }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const data = useRouteLoaderData<{
    user: { email: string; name?: string | null } | null
  }>("root")
  const user = data?.user
  const isSaveRoute = (location.pathname.replace(/\/+$/, "") || "/") === "/save"
  const shouldUseLibraryMediaView = useShouldUseLibraryMediaView()
  const shouldShowLayoutGuide = useShouldShowLayoutGuide()
  const [remotePlayOpen, setRemotePlayOpen] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await signOut()
      navigate("/", { viewTransition: true })
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }

  return (
    <header data-site-header className="fixed top-0 z-50 w-full bg-background">
      <div className="relative flex h-14 w-full items-center gap-3 px-6 md:h-16 md:px-8 lg:px-10 xl:px-14">
        <LogoLink variant="text-only" size="sm" />
        <div className="flex min-w-0 flex-1 justify-center overflow-x-auto">
          <div className="flex shrink-0 items-center gap-2">
            {isSaveRoute && (
              <Tabs
                value={shouldUseLibraryMediaView ? "library" : "list"}
                onValueChange={(value) =>
                  setShouldUseLibraryMediaView(value === "library")
                }
              >
                <TabsList aria-label="Save page view" className="h-10">
                  <TabsTrigger value="list" className="min-h-9 px-3 sm:px-4">
                    List
                  </TabsTrigger>
                  <TabsTrigger value="library" className="min-h-9 px-3 sm:px-4">
                    Library
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            {isSaveRoute && (
              <div
                data-layout-guide-toggle
                className="flex h-10 shrink-0 items-center gap-2 rounded-4xl bg-muted px-3 text-sm"
              >
                <span className="hidden sm:inline">Guide</span>
                <Switch
                  checked={shouldShowLayoutGuide}
                  onCheckedChange={setShouldShowLayoutGuide}
                  aria-label="Show layout guide"
                />
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {user ? (
            <>
              <UserNavActions
                name={user.name}
                email={user.email}
                showSaveAction={showSaveAction}
                remotePlayOpen={remotePlayOpen}
                onRemotePlayOpenChange={setRemotePlayOpen}
                onLogoutDialogOpen={() => setLogoutDialogOpen(true)}
              />
              <LogoutDialog
                open={logoutDialogOpen}
                onOpenChange={setLogoutDialogOpen}
                email={user.email}
                onLogout={() => void handleLogout()}
              />
            </>
          ) : (
            <GuestNavActions />
          )}
        </div>
      </div>
    </header>
  )
}
