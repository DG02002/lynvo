import * as React from "react"
import { useLocation, useRouteLoaderData } from "react-router"
import { Button } from "~/components/ui/button"
import { toast } from "sonner"
import { Turnstile, type TurnstileHandle } from "~/components/turnstile"
import { authCopy } from "~/features/auth/auth.copy"
import { authPaths } from "~/lib/paths"
import { validateUsername } from "~/lib/auth-policy"
import { signInWithConvexAuthHttp } from "~/lib/convex-auth-http"
import {
  AuthControl,
  AuthDivider,
  AuthFormShell,
  AuthSubmitButton,
  AuthTextField,
} from "./auth-form-parts"
import {
  authPreflight,
  initialTurnstileToken,
  redirectAfterAuth,
} from "./auth-form-actions"

export function SignInForm() {
  const location = useLocation()
  const rootData = useRouteLoaderData("root") as
    | { convexUrl?: string }
    | undefined
  const convexUrl = rootData?.convexUrl ?? ""
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const turnstileTokenRef = React.useRef<string | null>(null)
  if (turnstileTokenRef.current === null) {
    turnstileTokenRef.current = initialTurnstileToken()
  }
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [usernameError, setUsernameError] = React.useState<string | null>(null)
  const turnstileRef = React.useRef<TurnstileHandle>(null)

  const handleSubmit = async () => {
    const nextUsernameError = validateUsername(username)
    setUsernameError(nextUsernameError)
    if (nextUsernameError) {
      return
    }
    if (!password) {
      toast.error("Password is required.")
      return
    }
    if (!turnstileTokenRef.current) {
      toast.error("Complete the security check.")
      return
    }
    setIsSubmitting(true)
    try {
      const preflightToken = await authPreflight({
        flow: "signIn",
        username,
        turnstileToken: turnstileTokenRef.current,
      })
      const result = await signInWithConvexAuthHttp(convexUrl, "credentials", {
        flow: "signIn",
        username,
        password,
        preflightToken,
      })
      if (!result.signingIn) {
        throw new Error("Invalid username or password.")
      }
      toast.success("Signed in")
      redirectAfterAuth()
    } catch {
      toast.error("Invalid username or password.")
      turnstileRef.current?.reset()
      turnstileTokenRef.current = initialTurnstileToken()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthFormShell
      ariaLabel="Sign in form"
      heading={authCopy.signin.pageHeading}
      switchPrompt={authCopy.signin.switchPrompt}
      switchLinkText={authCopy.signin.switchLink}
      switchTo={`${authPaths.createAccount}${location.search}`}
      onSubmit={() => void handleSubmit()}
    >
      <AuthTextField
        id="username"
        name="username"
        value={username}
        onChange={setUsername}
        label="Username"
        error={usernameError}
      />
      <AuthTextField
        id="password"
        name="password"
        type="password"
        value={password}
        onChange={setPassword}
        label="Password"
      />
      <AuthControl>
        <Turnstile
          ref={turnstileRef}
          onVerify={(token) => {
            turnstileTokenRef.current = token
          }}
        />
      </AuthControl>
      <AuthSubmitButton
        isSubmitting={isSubmitting}
        submitText={authCopy.signin.submitButton}
        submittingText={authCopy.signin.submittingButton}
      />
      <AuthDivider />
      <AuthControl>
        <Button
          variant="secondary"
          size="lg"
          className="h-13.5 w-full"
          nativeButton={false}
          render={<a href={authPaths.signInWithAnotherDevice}>Use a QR Code</a>}
        />
      </AuthControl>
    </AuthFormShell>
  )
}
