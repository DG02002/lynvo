import { Logout05Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { ConfirmationAlertDialog } from "~/components/confirmation-alert-dialog"

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
    media={
      <HugeiconsIcon
        icon={Logout05Icon}
        className="mx-auto size-16 text-foreground"
      />
    }
    description={<>Logged in as {username}.</>}
    confirmLabel="Log out"
    onConfirm={onLogout}
  />
)
