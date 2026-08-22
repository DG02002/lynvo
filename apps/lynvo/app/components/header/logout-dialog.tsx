import { Logout05Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { ConfirmationAlertDialog } from "~/components/confirmation-alert-dialog"

export const LogoutDialog = ({
  open,
  onOpenChange,
  email,
  onLogout,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  email: string
  onLogout: () => void
}) => (
  <ConfirmationAlertDialog
    open={open}
    onOpenChange={onOpenChange}
    title="Log out of Lynvo?"
    media={
      <HugeiconsIcon
        icon={Logout05Icon}
        className="mx-auto size-16 text-destructive"
      />
    }
    description={<>Logged in as {email}.</>}
    confirmLabel="Log out"
    confirmVariant="destructive"
    onConfirm={onLogout}
  />
)
