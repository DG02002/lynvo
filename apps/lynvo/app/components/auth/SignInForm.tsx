import * as React from "react"
import { useForm } from "@tanstack/react-form"
import { useLocation, useRouteLoaderData } from "react-router"
import { Button } from "~/components/ui/button"
import { toast } from "sonner"
import { Turnstile, type TurnstileHandle } from "~/components/turnstile"
import { authCopy } from "~/features/auth/auth.copy"
import { authPaths } from "~/lib/paths"
import { signInSchema } from "~/lib/auth-form-schemas"
import { signInWithConvexAuthHttp } from "~/lib/convex-auth-http"
import {
  AuthControl,
  AuthDivider,
  AuthFormAlert,
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
  const turnstileTokenRef = React.useRef<string | null>(null)
  if (turnstileTokenRef.current === null) {
    turnstileTokenRef.current = initialTurnstileToken()
  }
  const [authenticationError, setAuthenticationError] = React.useState<
    string | null
  >(null)
  const turnstileRef = React.useRef<TurnstileHandle>(null)

  const form = useForm({
    defaultValues: {
      username: "",
      password: "",
    },
    validators: {
      onSubmit: signInSchema,
    },
    onSubmit: async ({ value }) => {
      setAuthenticationError(null)
      if (!turnstileTokenRef.current) {
        toast.error("Complete the security check.")
        return
      }

      try {
        const preflightToken = await authPreflight({
          flow: "signIn",
          username: value.username,
          turnstileToken: turnstileTokenRef.current,
        })
        const result = await signInWithConvexAuthHttp(
          convexUrl,
          "credentials",
          {
            flow: "signIn",
            username: value.username,
            password: value.password,
            preflightToken,
          }
        )
        if (!result.signingIn) {
          throw new Error("Invalid username or password.")
        }
        toast.success("Signed in")
        redirectAfterAuth()
      } catch {
        setAuthenticationError("Invalid username or password.")
        turnstileRef.current?.reset()
        turnstileTokenRef.current = initialTurnstileToken()
      }
    },
  })

  return (
    <AuthFormShell
      ariaLabel="Sign in form"
      heading={authCopy.signin.pageHeading}
      switchPrompt={authCopy.signin.switchPrompt}
      switchLinkText={authCopy.signin.switchLink}
      switchTo={`${authPaths.createAccount}${location.search}`}
      onSubmit={() => void form.handleSubmit()}
    >
      <form.Field
        name="username"
        children={(field) => (
          <AuthTextField
            id={field.name}
            name={field.name}
            value={field.state.value}
            onChange={(value) => {
              setAuthenticationError(null)
              field.handleChange(value)
            }}
            onBlur={field.handleBlur}
            label="Username"
            errors={field.state.meta.errors}
          />
        )}
      />
      <form.Field
        name="password"
        children={(field) => (
          <AuthTextField
            id={field.name}
            name={field.name}
            type="password"
            value={field.state.value}
            onChange={(value) => {
              setAuthenticationError(null)
              field.handleChange(value)
            }}
            onBlur={field.handleBlur}
            label="Password"
            errors={field.state.meta.errors}
          />
        )}
      />
      <AuthControl>
        <Turnstile
          ref={turnstileRef}
          onVerify={(token) => {
            turnstileTokenRef.current = token
          }}
        />
      </AuthControl>
      {authenticationError ? (
        <AuthFormAlert message={authenticationError} />
      ) : null}
      <form.Subscribe
        selector={(state) => state.isSubmitting}
        children={(isSubmitting) => (
          <AuthSubmitButton
            isSubmitting={isSubmitting}
            submitText={authCopy.signin.submitButton}
            submittingText={authCopy.signin.submittingButton}
          />
        )}
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
