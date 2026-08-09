import { ConfirmationAlertDialog } from "~/components/confirmation-alert-dialog"
interface RemoveLinkAlertDialogProps {
  item: { url: string; id?: string }
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
  <ConfirmationAlertDialog
    open={open}
    onOpenChange={onOpenChange}
    title="Remove this link?"
    description="This removes the link from your list. You can save it again from the source link."
    confirmLabel="Remove"
    confirmVariant="destructive"
    onConfirm={() => {
      onRemove(item.url, item.id)
      onOpenChange(false)
    }}
  />
)
