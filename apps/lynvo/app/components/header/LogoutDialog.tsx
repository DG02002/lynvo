import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"

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
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent className="p-10">
      <AlertDialogHeader className="place-items-center gap-4 w-full text-center">
        <AlertDialogTitle className="w-full px-0 text-center text-2xl font-normal leading-tight sm:px-10 sm:text-3xl">
          Are you sure you want to log out?
        </AlertDialogTitle>
        <AlertDialogDescription className="text-base text-center text-muted-foreground w-full">
          Log out of Lynvo as {username}?
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="flex flex-col gap-3 w-full mt-4">
        <AlertDialogAction
          onClick={onLogout}
          className="w-full h-12 text-sm rounded-full"
        >
          Log out
        </AlertDialogAction>
        <AlertDialogCancel
          variant="outline"
          className="w-full h-12 text-sm rounded-full border-muted-foreground/20"
        >
          Cancel
        </AlertDialogCancel>
      </div>
    </AlertDialogContent>
  </AlertDialog>
)
