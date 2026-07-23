import { NavLink, useRouteLoaderData, useNavigate } from "react-router"
import { useAuthActions } from "@convex-dev/auth/react"
import { LogoLink } from "~/components/logo"
import { useState } from "react"
import { GuestNavActions } from "./header/GuestNavActions"
import { LogoutDialog } from "./header/LogoutDialog"
import { UserNavActions } from "./header/UserNavActions"
import { sitePaths } from "~/lib/paths"

export function Header() {
  const navigate = useNavigate()
  const { signOut } = useAuthActions()
  const data = useRouteLoaderData("root") as
    | { user: { username: string } | null }
    | undefined
  const user = data?.user
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
      <div className="relative mx-auto flex h-16 max-w-5xl items-center justify-between px-4 md:px-8">
        <LogoLink variant="text-only" size="sm" />
        <nav
          aria-label="Primary navigation"
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 text-sm md:flex"
        >
          <NavLink
            to={sitePaths.docs}
            viewTransition
            className={({ isActive }) =>
              isActive
                ? "font-medium text-foreground"
                : "text-muted-foreground transition-colors hover:text-foreground"
            }
          >
            Docs
          </NavLink>
          <NavLink
            to={sitePaths.changelog}
            viewTransition
            className={({ isActive }) =>
              isActive
                ? "font-medium text-foreground"
                : "text-muted-foreground transition-colors hover:text-foreground"
            }
          >
            Changelog
          </NavLink>
          <NavLink
            to={sitePaths.pricing}
            viewTransition
            className={({ isActive }) =>
              isActive
                ? "font-medium text-foreground"
                : "text-muted-foreground transition-colors hover:text-foreground"
            }
          >
            Plans
          </NavLink>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <UserNavActions
                username={user.username}
                remotePlayOpen={remotePlayOpen}
                onRemotePlayOpenChange={setRemotePlayOpen}
                onLogoutDialogOpen={() => setLogoutDialogOpen(true)}
              />
              <LogoutDialog
                open={logoutDialogOpen}
                onOpenChange={setLogoutDialogOpen}
                username={user.username}
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
