import { Link } from "react-router"
import { buttonVariants } from "~/components/ui/button-variants"
import { authCopy } from "~/features/auth/auth.copy"
import { authPaths } from "~/lib/paths"
import { cn } from "~/lib/utils"

export const GuestNavActions = () => (
  <div className="flex items-center gap-2">
    <Link
      to={authPaths.signIn}
      viewTransition
      className={cn(buttonVariants({ variant: "default" }), "px-4")}
    >
      {authCopy.nav.signIn}
    </Link>
    <Link
      to={authPaths.createAccount}
      viewTransition
      className={cn(
        buttonVariants({ variant: "outline" }),
        "hidden px-4 sm:inline-flex"
      )}
    >
      {authCopy.nav.signUp}
    </Link>
  </div>
)
