import { useState } from "react"
import {
  Link,
  useLocation,
  useNavigate,
  useRouteLoaderData,
} from "react-router"

import { LogoLink } from "~/components/logo"
import { useViewTransition } from "~/lib/client-profile"
import { isDocsRoutePathname, sitePaths } from "~/lib/paths"
import { signOut } from "~/lib/session-http"

import { GuestNavActions } from "./header/guest-nav-actions"
import { LogoutDialog } from "./header/logout-dialog"
import { UserNavActions } from "./header/user-nav-actions"

export const Header = ({ showSaveAction }: { showSaveAction: boolean }) => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const data = useRouteLoaderData<{
    user: { email: string; name?: string | null } | null
  }>("root")
  const user = data?.user
  const [remotePlayOpen, setRemotePlayOpen] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const viewTransition = useViewTransition()
  const isDocsRoute = isDocsRoutePathname(pathname)
  const developerRoot = sitePaths.developerDocs
  const isDeveloperRoute =
    pathname === developerRoot || pathname.startsWith(`${developerRoot}/`)

  const handleLogout = async () => {
    try {
      await signOut()
      await navigate("/", { viewTransition })
    } catch (error) {
      console.error("Sign-out failed:", error)
    }
  }

  const navigationActions = (
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
  )

  return (
    <header
      data-site-header
      className={`fixed top-0 z-50 w-full bg-background ${isDocsRoute ? "border-b border-border" : ""}`}
    >
      <div
        className={
          isDocsRoute
            ? "flex h-14 w-full items-center md:h-16"
            : "relative flex h-14 w-full items-center gap-3 px-6 md:h-16 md:px-8 lg:px-10 xl:px-14"
        }
      >
        <div
          className={
            isDocsRoute
              ? "flex h-full shrink-0 items-center gap-2 border-r border-border px-6 md:px-8 lg:w-72 lg:gap-3 lg:px-5 xl:w-80 xl:px-6"
              : "flex shrink-0 items-center"
          }
        >
          <LogoLink
            variant="text-only"
            size="sm"
            className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          {isDocsRoute && (
            <>
              <span aria-hidden="true" className="h-5 w-0.5 bg-foreground/25" />
              <Link
                to={isDeveloperRoute ? developerRoot : sitePaths.docs}
                prefetch="intent"
                aria-current={
                  pathname ===
                  (isDeveloperRoute ? developerRoot : sitePaths.docs)
                    ? "page"
                    : undefined
                }
                className="rounded-sm text-lg font-semibold text-muted-foreground transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {isDeveloperRoute ? "Developer" : "Docs"}
              </Link>
            </>
          )}
        </div>

        {isDocsRoute ? (
          <div className="min-w-0 flex-1">
            <div className="mx-auto flex h-full w-full max-w-[80rem] items-center justify-end px-6 md:px-8 xl:px-10">
              {navigationActions}
            </div>
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1" />
            {navigationActions}
          </>
        )}
      </div>
    </header>
  )
}
