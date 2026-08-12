import { useRouteLoaderData, useNavigate } from "react-router"
import { LogoLink } from "~/components/logo"
import { useState } from "react"
import { GuestNavActions } from "./header/GuestNavActions"
import { LogoutDialog } from "./header/LogoutDialog"
import { UserNavActions } from "./header/UserNavActions"
import { signOutWithWorkerSession } from "~/lib/worker-auth-session-http"

export function Header({ showSaveAction }: { showSaveAction: boolean }) {
  const navigate = useNavigate()
  const data = useRouteLoaderData("root") as
    | { user: { username: string } | null }
    | undefined
  const user = data?.user
  const [remotePlayOpen, setRemotePlayOpen] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await signOutWithWorkerSession()
      navigate("/", { viewTransition: true })
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }

  return (
    <header data-site-header className="fixed top-0 z-50 w-full bg-background">
      <div className="relative flex h-14 w-full items-center justify-between px-6 md:h-16 md:px-8 lg:px-10 xl:px-14">
        <LogoLink variant="text-only" size="sm" />
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <UserNavActions
                username={user.username}
                showSaveAction={showSaveAction}
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
