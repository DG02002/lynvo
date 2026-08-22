import * as React from "react"
import { Link } from "react-router"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { toast } from "sonner"
import { FieldSet } from "~/components/field"
import { LynvoLink } from "~/components/lynvo-link"
import { authPaths } from "~/lib/paths"
import { AuthPolicyLinks } from "./auth-form-parts"
import { useExpiryClock } from "./use-expiry-clock"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"
import { authorizeDeviceCode, readDeviceCodeApproval } from "./device-auth-http"
import { useAsyncResource } from "~/hooks/use-async-resource"

export default function DeviceApproval() {
  const params = new URLSearchParams(
    globalThis.window !== undefined ? window.location.search : ""
  )
  const code = params.get("user_code") ?? ""
  const hasValidCode = /^[A-Z]{4}-[A-Z]{4}$/.test(code)
  const { data: codeRecord, isLoading: isCodeQueryPending } = useAsyncResource(
    () =>
      hasValidCode ? readDeviceCodeApproval(code) : Promise.resolve(undefined),
    [code, hasValidCode]
  )
  const isCheckingCode = hasValidCode && isCodeQueryPending
  const hasExpired = useExpiryClock(codeRecord?.expiresAt)
  const canApprove = codeRecord?.status === "pending" && !hasExpired
  const [loading, setLoading] = React.useState(false)
  const [success, setSuccess] = React.useState(false)

  const handleAuthorize = async () => {
    if (!code) {
      return
    }
    setLoading(true)
    try {
      await authorizeDeviceCode(code)
      setSuccess(true)
      toast.success("Login approved")
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(
          error,
          "The login couldn’t be approved. Check the code, then try again."
        )
      )
    } finally {
      setLoading(false)
    }
  }

  const heading = success
    ? "Login approved"
    : isCheckingCode || (codeRecord && canApprove)
      ? "Approve login"
      : "Code invalid or expired"

  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <div className="flex-1 py-6 pb-16 md:py-8 md:pb-8">
        <FieldSet className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 text-center">
            <LynvoLink className="text-lg font-medium text-foreground no-underline hover:text-foreground hover:no-underline focus-visible:no-underline" />
            <h1 className="text-4xl font-normal tracking-tight">{heading}</h1>
            {success ? (
              <p className="text-balance text-lg text-muted-foreground">
                The other device is now logged in.
              </p>
            ) : isCheckingCode ? (
              <div
                className="flex items-center justify-center gap-2 text-muted-foreground"
                role="status"
              >
                <Spinner aria-hidden="true" />
                <span>Checking code…</span>
              </div>
            ) : (
              <>
                <p className="text-balance text-lg text-muted-foreground">
                  {canApprove
                    ? "Confirm this code is shown on your device."
                    : "Generate a new code on the device you want to log in."}
                </p>
                {canApprove && (
                  <p
                    aria-label="Login verification code"
                    className="my-8 text-3xl font-normal tracking-[0.16em] text-foreground tabular-nums sm:text-4xl"
                  >
                    {code}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
            {success ? (
              <Button
                className="h-13.5 w-full"
                nativeButton={false}
                render={
                  <Link to="/" viewTransition>
                    Go home
                  </Link>
                }
              />
            ) : (
              <>
                {canApprove && (
                  <Button
                    type="button"
                    className="h-13.5 w-full"
                    disabled={loading}
                    onClick={() => void handleAuthorize()}
                  >
                    {loading ? "Approving login…" : "Approve login"}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  className="h-13.5 w-full"
                  nativeButton={false}
                  render={
                    <Link to={authPaths.signIn} viewTransition>
                      Back to log in
                    </Link>
                  }
                />
              </>
            )}
          </div>

          <AuthPolicyLinks />
        </FieldSet>
      </div>
    </div>
  )
}
