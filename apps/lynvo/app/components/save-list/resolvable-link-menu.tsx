import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CopyIcon,
  Delete02Icon,
  EllipsisIcon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { ConfirmationAlertDialog } from "~/components/confirmation-alert-dialog"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"

interface ResolvableLinkMenuProps {
  itemLabel: string
  onCopyLink: () => void
  onRefresh: () => void
  onRemove: () => void
  triggerClassName: string
}

export const ResolvableLinkMenu = ({
  itemLabel,
  onCopyLink,
  onRefresh,
  onRemove,
  triggerClassName,
}: ResolvableLinkMenuProps) => {
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className={triggerClassName}>
              <HugeiconsIcon icon={EllipsisIcon} />
              <span className="sr-only">Open menu for {itemLabel}</span>
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => {
                onCopyLink()
                toast.success("Link copied")
              }}
            >
              <HugeiconsIcon icon={CopyIcon} />
              Copy link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRefresh}>
              <HugeiconsIcon icon={Refresh01Icon} />
              Refresh playable links
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setIsRemoveDialogOpen(true)}
            >
              <HugeiconsIcon icon={Delete02Icon} />
              Remove link
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationAlertDialog
        open={isRemoveDialogOpen}
        onOpenChange={setIsRemoveDialogOpen}
        title="Remove this link?"
        description="This removes the link from the playable choices."
        confirmLabel="Remove link"
        confirmVariant="destructive"
        onConfirm={() => {
          onRemove()
          setIsRemoveDialogOpen(false)
        }}
      />
    </>
  )
}
