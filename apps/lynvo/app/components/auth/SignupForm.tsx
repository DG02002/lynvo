import * as React from "react"
import { useForm } from "@tanstack/react-form"
import { useLocation, useRouteLoaderData } from "react-router"
import { toast } from "sonner"
import { Turnstile, type TurnstileHandle } from "~/components/turnstile"
import { authCopy } from "~/features/auth/auth.copy"
import { authPaths } from "~/lib/paths"
import { signUpSchema } from "~/lib/auth-form-schemas"
import { signInWithConvexAuthHttp } from "~/lib/convex-auth-http"
import {
  AuthControl,
  AuthFormAlert,
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
  const turnstileTokenRef = React.useRef<string | null>(null)
  if (turnstileTokenRef.current === null) {
    turnstileTokenRef.current = initialTurnstileToken()
  }
  const [accountCreationError, setAccountCreationError] = React.useState<
    string | null
  >(null)
  const turnstileRef = React.useRef<TurnstileHandle>(null)

  const form = useForm({
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
    },
    validators: {
      onSubmit: signUpSchema,
    },
    onSubmit: async ({ value }) => {
      setAccountCreationError(null)
      if (!turnstileTokenRef.current) {
        toast.error("Complete the security check.")
        return
      }

      try {
        const preflightToken = await authPreflight({
          flow: "signUp",
          username: value.username,
          turnstileToken: turnstileTokenRef.current,
        })
        const result = await withTimeout(
          signInWithConvexAuthHttp(convexUrl, "credentials", {
            flow: "signUp",
            username: value.username,
            password: value.password,
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
        setAccountCreationError(
          error instanceof Error
            ? error.message
            : "Unable to create the account. Check the details and try again."
        )
        turnstileRef.current?.reset()
        turnstileTokenRef.current = initialTurnstileToken()
      }
    },
  })

  return (
    <AuthFormShell
      ariaLabel="Create an account form"
      heading={authCopy.signup.pageHeading}
      switchPrompt={authCopy.signup.switchPrompt}
      switchLinkText={authCopy.signup.switchLink}
      switchTo={`${authPaths.signIn}${location.search}`}
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
              setAccountCreationError(null)
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
              setAccountCreationError(null)
              field.handleChange(value)
            }}
            onBlur={field.handleBlur}
            label="Password"
            errors={field.state.meta.errors}
          />
        )}
      />
      <form.Field
        name="confirmPassword"
        children={(field) => (
          <AuthTextField
            id={field.name}
            name={field.name}
            type="password"
            value={field.state.value}
            onChange={(value) => {
              setAccountCreationError(null)
              field.handleChange(value)
            }}
            onBlur={field.handleBlur}
            label="Confirm Password"
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
      {accountCreationError ? (
        <AuthFormAlert message={accountCreationError} />
      ) : null}
      <form.Subscribe
        selector={(state) => state.isSubmitting}
        children={(isSubmitting) => (
          <AuthSubmitButton
            isSubmitting={isSubmitting}
            submitText={authCopy.signup.submitButton}
            submittingText={authCopy.signup.submittingButton}
          />
        )}
      />
    </AuthFormShell>
  )
}
