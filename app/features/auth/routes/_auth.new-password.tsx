import * as React from "react"
import { useNavigate, type LoaderFunctionArgs } from "react-router"
import { useAction } from "convex/react"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { toast } from "sonner"
import { FieldGroup, FieldSet } from "~/components/field"
import { LynvoLink } from "~/components/LynvoLink"
import { validatePassword } from "~/lib/auth-policy"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"
import { api } from "../../../../convex/_generated/api"
import { getUserSession, requireUserOrRedirect } from "~/lib/auth"
import { getServerEnv } from "~/lib/env.server"
import {
  AuthControl,
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
  const [oldPassword, setOldPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errors, setErrors] = React.useState<{
    oldPassword?: string
    newPassword?: string
    confirmPassword?: string
  }>({})

  const validate = () => {
    const nextErrors: typeof errors = {}
    if (!oldPassword) {
      nextErrors.oldPassword = "Old password is required."
    }
    const passwordError = validatePassword(newPassword, "")
    if (passwordError) {
      nextErrors.newPassword = passwordError
    }
    if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match."
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!validate()) {
      return
    }
    setIsSubmitting(true)
    try {
      await changePassword({
        currentPassword: oldPassword,
        newPassword,
      })
      toast.success("Password changed")
      navigate("/settings", { viewTransition: true })
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(
          error,
          "Unable to change the password. Try again."
        )
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <div className="flex-1 py-6 pb-16 md:py-8 md:pb-8">
        <form onSubmit={handleSubmit} aria-label="Change password form">
          <FieldSet className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 text-center">
              <LynvoLink className="text-lg font-medium text-foreground no-underline hover:text-foreground hover:no-underline focus-visible:no-underline" />
              <h1 className="text-4xl font-normal tracking-tight">
                Change your password
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Enter a new password below to change your password
              </p>
            </div>
            <FieldGroup className="gap-4">
              <AuthTextField
                id="oldPassword"
                name="oldPassword"
                type="password"
                value={oldPassword}
                onChange={setOldPassword}
                label="Old password"
                error={errors.oldPassword}
              />
              <AuthTextField
                id="newPassword"
                name="newPassword"
                type="password"
                value={newPassword}
                onChange={setNewPassword}
                label="New password"
                error={errors.newPassword}
              />
              <AuthTextField
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                label="Re-enter new password"
                error={errors.confirmPassword}
              />

              <AuthControl>
                <Button
                  type="submit"
                  size="lg"
                  className="h-13.5 w-full mt-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Spinner className="mr-2 size-4" />}
                  {isSubmitting ? "Changing…" : "Continue"}
                </Button>
              </AuthControl>
            </FieldGroup>
            <AuthPolicyLinks />
          </FieldSet>
        </form>
      </div>
    </div>
  )
}
