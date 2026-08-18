import { HugeiconsIcon } from "@hugeicons/react"
import { FolderLibraryIcon } from "@hugeicons/core-free-icons"
import { Link } from "react-router"
import { buttonVariants } from "~/components/ui/button-variants"
import { RemotePlayButton } from "~/components/RemotePlayButton"
import { cn } from "~/lib/utils"
import { UserMenu } from "./UserMenu"

export const UserNavActions = ({
  username,
  showSaveAction,
  remotePlayOpen,
  onRemotePlayOpenChange,
  onLogoutDialogOpen,
}: {
  username: string
  showSaveAction: boolean
  remotePlayOpen: boolean
  onRemotePlayOpenChange: (open: boolean) => void
  onLogoutDialogOpen: () => void
}) => (
  <>
    {showSaveAction && (
      <Link
        to="/save"
        prefetch="intent"
        viewTransition
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
      username={username}
      onRemotePlay={() => onRemotePlayOpenChange(true)}
      onLogout={onLogoutDialogOpen}
    />
  </>
)
