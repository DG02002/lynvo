import { Link } from "react-router"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { policyPaths } from "~/lib/paths"
import { cn } from "~/lib/utils"

interface AuthFormAlertProps {
  message: string
}

interface AuthDividerProps {
  className?: string
}

export const AuthFormAlert = ({ message }: AuthFormAlertProps) => (
  <div className="mx-auto w-full max-w-sm">
    <Alert variant="destructive">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  </div>
)

export const AuthDivider = ({ className }: AuthDividerProps) => (
  <div
    data-auth-divider
    className={cn("relative my-1 w-full max-w-xs self-center", className)}
  >
    <div className="absolute inset-0 flex items-center">
      <span className="w-full border-t border-border" />
    </div>
    <div className="relative flex justify-center text-xs uppercase">
      <span className="bg-background px-2 text-muted-foreground">Or</span>
    </div>
  </div>
)

export const AuthPolicyLinks = () => (
  <div
    data-auth-form-policies
    className="mt-3 space-x-1 text-center text-xs text-muted-foreground"
  >
    <Link
      to={policyPaths.termsOfUse}
      viewTransition
      className="underline underline-offset-4"
    >
      Terms of use
    </Link>
    <span> | </span>
    <Link
      to={policyPaths.privacyPolicy}
      viewTransition
      className="underline underline-offset-4"
    >
      Privacy policy
    </Link>
  </div>
)
