import * as React from "react"
import { useLocation, useRouteLoaderData } from "react-router"
import { toast } from "sonner"
import { Turnstile, type TurnstileHandle } from "~/components/turnstile"
import { authCopy } from "~/features/auth/auth.copy"
import { authPaths } from "~/lib/paths"
import { validatePassword, validateUsername } from "~/lib/auth-policy"
import { signInWithConvexAuthHttp } from "~/lib/convex-auth-http"
import {
  AuthControl,
  AuthFormShell,
  AuthSubmitButton,
  AuthTextField,
} from "./auth-form-parts"
import {
  authPreflight,
  initialTurnstileToken,
  redirectAfterAuth,
  withTimeout,
} from "./auth-form-actions"

export function SignupForm() {
  const location = useLocation()
  const rootData = useRouteLoaderData("root") as
    | { convexUrl?: string }
    | undefined
  const convexUrl = rootData?.convexUrl ?? ""
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const turnstileTokenRef = React.useRef<string | null>(null)
  if (turnstileTokenRef.current === null) {
    turnstileTokenRef.current = initialTurnstileToken()
  }
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errors, setErrors] = React.useState<{
    username?: string
    password?: string
    confirmPassword?: string
  }>({})
  const turnstileRef = React.useRef<TurnstileHandle>(null)

  const validate = () => {
    const nextErrors: typeof errors = {}
    const usernameError = validateUsername(username)
    if (usernameError) {
      nextErrors.username = usernameError
    }
    const passwordError = validatePassword(password, username)
    if (passwordError) {
      nextErrors.password = passwordError
    }
    if (password !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match."
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) {
      return
    }
    if (!turnstileTokenRef.current) {
      toast.error("Complete the security check.")
      return
    }
    setIsSubmitting(true)
    try {
      const preflightToken = await authPreflight({
        flow: "signUp",
        username,
        turnstileToken: turnstileTokenRef.current,
      })
      const result = await withTimeout(
        signInWithConvexAuthHttp(convexUrl, "credentials", {
          flow: "signUp",
          username,
          password,
          preflightToken,
        }),
        12_000,
        "Convex sign-in timed out."
      )
      if (!result.signingIn) {
        throw new Error(
          "Unable to create the account. Check the details and try again."
        )
      }
      toast.success("Account created")
      redirectAfterAuth()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to create the account. Check the details and try again."
      )
      turnstileRef.current?.reset()
      turnstileTokenRef.current = initialTurnstileToken()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthFormShell
      ariaLabel="Create an account form"
      heading={authCopy.signup.pageHeading}
      switchPrompt={authCopy.signup.switchPrompt}
      switchLinkText={authCopy.signup.switchLink}
      switchTo={`${authPaths.signIn}${location.search}`}
      onSubmit={() => void handleSubmit()}
    >
      <AuthTextField
        id="username"
        name="username"
        value={username}
        onChange={setUsername}
        label="Username"
        error={errors.username}
      />
      <AuthTextField
        id="password"
        name="password"
        type="password"
        value={password}
        onChange={setPassword}
        label="Password"
        error={errors.password}
      />
      <AuthTextField
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        label="Confirm Password"
        error={errors.confirmPassword}
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
        submitText={authCopy.signup.submitButton}
        submittingText={authCopy.signup.submittingButton}
      />
    </AuthFormShell>
  )
}
