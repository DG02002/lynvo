import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import type { LinkViewItem } from "~/features/links/types"

interface RemoveLinkAlertDialogProps {
  item: LinkViewItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onRemove: (url: string, id?: string) => void
}

export const RemoveLinkAlertDialog = ({
  item,
  open,
  onOpenChange,
  onRemove,
}: RemoveLinkAlertDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent className="p-10">
      <AlertDialogHeader className="w-full place-items-center gap-4 text-center">
        <AlertDialogTitle className="w-full px-0 text-center text-2xl font-normal leading-tight sm:px-10 sm:text-3xl">
          Remove this link?
        </AlertDialogTitle>
        <AlertDialogDescription className="w-full text-center text-base text-muted-foreground">
          This removes the link from your list. You can save it again from the
          source link.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="mt-4 flex w-full flex-col gap-3">
        <AlertDialogAction
          className="h-12 w-full rounded-full text-sm"
          variant="destructive"
          onClick={() => {
            onRemove(item.url, item.id)
            onOpenChange(false)
          }}
        >
          Remove
        </AlertDialogAction>
        <AlertDialogCancel
          variant="outline"
          className="h-12 w-full rounded-full border-muted-foreground/20 text-sm"
        >
          Cancel
        </AlertDialogCancel>
      </div>
    </AlertDialogContent>
  </AlertDialog>
)
