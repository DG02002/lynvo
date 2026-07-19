import { useRouteLoaderData, useNavigate } from "react-router"
import { useAuthActions } from "@convex-dev/auth/react"
import { LogoLink } from "~/components/logo"
import { useState } from "react"
import { GuestNavActions } from "./header/GuestNavActions"
import { LogoutDialog } from "./header/LogoutDialog"
import { UserNavActions } from "./header/UserNavActions"

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
      <div className="mx-auto max-w-5xl flex h-16 items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-4 md:gap-6">
          <LogoLink variant="text-only" size="sm" />
        </div>
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
