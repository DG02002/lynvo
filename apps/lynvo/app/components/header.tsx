import { ChevronRightIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"
import {
  Link,
  useLocation,
  useNavigate,
  useRouteLoaderData,
} from "react-router"

import { LogoLink } from "~/components/logo"
import { useDocsBreadcrumb } from "~/features/site/docs/docs-breadcrumb"
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
  const breadcrumb = useDocsBreadcrumb()

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
              ? "flex h-full shrink-0 items-center gap-2 border-r border-border px-3 sm:px-4 lg:w-72 lg:gap-3 lg:px-5 xl:w-80 xl:px-6"
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
              <span aria-hidden="true" className="h-5 w-px bg-border" />
              <Link
                to={sitePaths.docs}
                prefetch="intent"
                aria-current={pathname === sitePaths.docs ? "page" : undefined}
                className="rounded-sm text-sm font-medium text-foreground transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Docs
              </Link>
            </>
          )}
        </div>

        {isDocsRoute ? (
          <div className="min-w-0 flex-1">
            <div className="mx-auto flex h-full w-full max-w-[80rem] items-center gap-2 px-6 md:px-8 xl:px-10">
              {breadcrumb && (
                <nav
                  aria-label="Breadcrumb"
                  className="flex min-w-0 items-center gap-2 overflow-hidden text-sm"
                >
                  <span className="sr-only sm:not-sr-only sm:shrink-0 sm:text-muted-foreground">
                    {breadcrumb.group}
                  </span>
                  <HugeiconsIcon
                    icon={ChevronRightIcon}
                    aria-hidden="true"
                    className="hidden size-3.5 shrink-0 text-muted-foreground sm:block"
                    strokeWidth={1.5}
                  />
                  <span
                    aria-current="page"
                    className="truncate font-medium text-foreground"
                  >
                    {breadcrumb.pageLabel}
                  </span>
                </nav>
              )}
              <div className="min-w-0 flex-1" />
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
