import { Link, useLocation } from "react-router"
import { LynvoLink } from "~/components/lynvo-link"
import { GoogleSignInButton } from "~/components/auth/google-sign-in-button"
import {
  AuthDivider,
  AuthFormAlert,
  AuthPolicyLinks,
} from "~/components/auth/auth-form-parts"
import { Button } from "~/components/ui/button"
import { authCopy } from "~/features/auth/auth.copy"
import { normalizeReturnTo } from "~/lib/auth-cookie"
import { authPaths } from "~/lib/paths"

export const meta = () => [
  { title: authCopy.signin.metaTitle },
  { name: "description", content: authCopy.signin.metaDescription },
]

const getSignInErrorMessage = (errorReason: string | null) => {
  if (errorReason === "state") {
    return authCopy.signin.expiredError
  }

  if (errorReason === "exchange") {
    return authCopy.signin.exchangeError
  }

  if (errorReason === "invalid_token") {
    return authCopy.signin.invalidTokenError
  }

  if (errorReason) {
    return authCopy.signin.fallbackError
  }

  return null
}

const SignIn = () => {
  const location = useLocation()
  const url = new URL(location.pathname + location.search, "https://lynvo.test")
  const returnTo = normalizeReturnTo(
    url.searchParams.get("redirect") ?? undefined
  )
  const errorReason = url.searchParams.get("error")
  const errorMessage = getSignInErrorMessage(errorReason)

  return (
    <div
      data-google-sign-in-page
      className="mx-auto flex w-full max-w-md flex-col"
    >
      <div data-google-sign-in-content className="flex-1 py-6 pb-16 md:py-8">
        <div
          data-google-sign-in-stack
          className="mx-auto flex w-full max-w-sm flex-col gap-6 text-center"
        >
          <LynvoLink className="text-lg font-medium text-foreground no-underline hover:text-foreground hover:no-underline focus-visible:no-underline" />
          <h1 className="mb-4 text-4xl font-normal tracking-tight">
            {authCopy.signin.pageHeading}
          </h1>
          {errorMessage ? <AuthFormAlert message={errorMessage} /> : null}
          <GoogleSignInButton
            returnTo={returnTo === "/" ? undefined : returnTo}
          />
          <AuthDivider />
          <Button
            variant="secondary"
            className="h-13.5 w-full max-w-xs self-center font-normal"
            nativeButton={false}
            render={
              <Link to={authPaths.signInWithAnotherDevice} viewTransition>
                {authCopy.signin.qrButton}
              </Link>
            }
          />
          <AuthPolicyLinks />
        </div>
      </div>
    </div>
  )
}

export default SignIn
