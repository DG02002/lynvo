import { ConfirmationAlertDialog } from "~/components/ui/confirmation-alert-dialog"

export const LogoutDialog = ({
  open,
  onOpenChange,
  username,
  onLogout,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  username: string
  onLogout: () => void
}) => (
  <ConfirmationAlertDialog
    open={open}
    onOpenChange={onOpenChange}
    title="Log out of Lynvo?"
    description={<>Logged in as {username}.</>}
    confirmLabel="Log out"
    onConfirm={onLogout}
  />
)
