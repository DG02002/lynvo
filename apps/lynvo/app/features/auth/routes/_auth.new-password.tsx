import * as React from "react"
import { useForm } from "@tanstack/react-form"
import { useNavigate, type LoaderFunctionArgs } from "react-router"
import { useAction } from "convex/react"
import { toast } from "sonner"
import { FieldGroup, FieldSet } from "~/components/field"
import { LynvoLink } from "~/components/LynvoLink"
import { changePasswordSchema } from "~/lib/auth-form-schemas"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"
import { api } from "../../../../convex/_generated/api"
import { getUserSession, requireUserOrRedirect } from "~/lib/auth"
import { getServerEnv } from "~/lib/env.server"
import {
  AuthFormAlert,
  AuthSubmitButton,
  AuthPolicyLinks,
  AuthTextField,
} from "~/components/auth/auth-form-parts"

export function meta() {
  return [{ title: "Change your password | Lynvo" }]
}

export async function loader(args: LoaderFunctionArgs): Promise<any> {
  const request = args.request
  const env = getServerEnv(args.context)
  const sessionResult = await getUserSession(request, env)
  requireUserOrRedirect(sessionResult, "/auth/reset-password/new-password")
  return null
}

export default function NewPassword() {
  const navigate = useNavigate()
  const changePassword = useAction(api.users.changePassword)
  const [passwordChangeError, setPasswordChangeError] = React.useState<
    string | null
  >(null)
  const form = useForm({
    defaultValues: {
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    validators: {
      onSubmit: changePasswordSchema,
    },
    onSubmit: async ({ value }) => {
      setPasswordChangeError(null)
      try {
        await changePassword({
          currentPassword: value.oldPassword,
          newPassword: value.newPassword,
        })
        toast.success("Password changed")
        navigate("/settings", { viewTransition: true })
      } catch (error) {
        setPasswordChangeError(
          getUserFacingErrorMessage(
            error,
            "The password couldn’t be changed. Check the current password, then try again."
          )
        )
      }
    },
  })

  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <div className="flex-1 py-6 pb-16 md:py-8 md:pb-8">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
          aria-label="Change password form"
        >
          <FieldSet className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 text-center">
              <LynvoLink className="text-lg font-medium text-foreground no-underline hover:text-foreground hover:no-underline focus-visible:no-underline" />
              <h1 className="text-4xl font-normal tracking-tight">
                Change your password
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Enter the current password, then choose a new password.
              </p>
            </div>
            <FieldGroup className="gap-4">
              <form.Field
                name="oldPassword"
                children={(field) => (
                  <AuthTextField
                    id={field.name}
                    name={field.name}
                    type="password"
                    value={field.state.value}
                    onChange={(value) => {
                      setPasswordChangeError(null)
                      field.handleChange(value)
                    }}
                    onBlur={field.handleBlur}
                    label="Current password"
                    errors={field.state.meta.errors}
                  />
                )}
              />
              <form.Field
                name="newPassword"
                children={(field) => (
                  <AuthTextField
                    id={field.name}
                    name={field.name}
                    type="password"
                    value={field.state.value}
                    onChange={(value) => {
                      setPasswordChangeError(null)
                      field.handleChange(value)
                    }}
                    onBlur={field.handleBlur}
                    label="New password"
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
                      setPasswordChangeError(null)
                      field.handleChange(value)
                    }}
                    onBlur={field.handleBlur}
                    label="Re-enter new password"
                    errors={field.state.meta.errors}
                  />
                )}
              />
              {passwordChangeError ? (
                <AuthFormAlert message={passwordChangeError} />
              ) : null}
              <form.Subscribe
                selector={(state) => state.isSubmitting}
                children={(isSubmitting) => (
                  <AuthSubmitButton
                    isSubmitting={isSubmitting}
                    submitText="Change password"
                    submittingText="Changing password…"
                    className="mt-2"
                  />
                )}
              />
            </FieldGroup>
            <AuthPolicyLinks />
          </FieldSet>
        </form>
      </div>
    </div>
  )
}
