import { FolderLibraryIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "react-router"

import { RemotePlayButton } from "~/components/remote-play-button"
import { buttonVariants } from "~/components/ui/button-variants"
import { useViewTransition } from "~/lib/client-profile"
import { cn } from "~/lib/utils"

import { UserMenu } from "./user-menu"

export const UserNavActions = ({
  name,
  email,
  showSaveAction,
  remotePlayOpen,
  onRemotePlayOpenChange,
  onLogoutDialogOpen,
}: {
  name?: string | null
  email: string
  showSaveAction: boolean
  remotePlayOpen: boolean
  onRemotePlayOpenChange: (open: boolean) => void
  onLogoutDialogOpen: () => void
}) => {
  const viewTransition = useViewTransition()

  return (
    <>
      {showSaveAction && (
        <Link
          to="/save"
          prefetch="intent"
          viewTransition={viewTransition}
          aria-label="Save"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "gap-2 px-2 sm:px-4 text-foreground rounded-full"
          )}
        >
          <HugeiconsIcon icon={FolderLibraryIcon} className="size-4" />
          <span className="hidden text-base font-normal sm:inline">Save</span>
        </Link>
      )}

      <RemotePlayButton
        open={remotePlayOpen}
        onOpenChange={onRemotePlayOpenChange}
        trigger={null}
      />

      <UserMenu
        name={name}
        email={email}
        onRemotePlay={() => onRemotePlayOpenChange(true)}
        onLogout={onLogoutDialogOpen}
      />
    </>
  )
}
