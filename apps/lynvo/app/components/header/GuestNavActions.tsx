import { Link } from "react-router"
import { buttonVariants } from "~/components/ui/button-variants"
import { authCopy } from "~/features/auth/auth.copy"
import { authPaths } from "~/lib/paths"
import { cn } from "~/lib/utils"

export const GuestNavActions = () => (
  <div className="flex items-center gap-2">
    <Link
      to={authPaths.signIn}
      prefetch="intent"
      viewTransition
      className={cn(buttonVariants({ variant: "default" }), "px-4")}
    >
      {authCopy.nav.signIn}
    </Link>
  </div>
)
