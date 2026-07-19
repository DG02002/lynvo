import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CopyIcon,
  Delete02Icon,
  EllipsisIcon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"

interface ResolvableLinkMenuProps {
  onCopyLink: () => void
  onRefresh: () => void
  onRemove: () => void
}

export const ResolvableLinkMenu = ({
  onCopyLink,
  onRefresh,
  onRemove,
}: ResolvableLinkMenuProps) => {
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="size-9">
              <HugeiconsIcon icon={EllipsisIcon} />
              <span className="sr-only">Open resolvable item menu</span>
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => {
                onCopyLink()
                toast.success("Copied")
              }}
            >
              <HugeiconsIcon icon={CopyIcon} />
              Copy link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRefresh}>
              <HugeiconsIcon icon={Refresh01Icon} />
              Refresh
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setIsRemoveDialogOpen(true)}
            >
              <HugeiconsIcon icon={Delete02Icon} />
              Remove
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={isRemoveDialogOpen}
        onOpenChange={setIsRemoveDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-normal">
              Remove this item?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the resolvable item from the saved folder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onRemove()
                setIsRemoveDialogOpen(false)
              }}
            >
              Remove
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
