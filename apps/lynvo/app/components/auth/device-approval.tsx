import * as React from "react"
import { Link } from "react-router"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/spinner"
import { showErrorToast } from "~/lib/toast-notifications"
import { FieldSet } from "~/components/field"
import { LynvoLink } from "~/components/lynvo-link"
import { authPaths } from "~/lib/paths"
import { AuthPolicyLinks } from "./auth-form-parts"
import { useExpiryClock } from "./use-expiry-clock"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"
import { authorizeDeviceCode, readDeviceCodeApproval } from "./device-auth-http"
import { useAsyncResource } from "~/hooks/use-async-resource"

interface DeviceApprovalStatusMessageProps {
  readonly code: string
  readonly canApprove: boolean
  readonly didApprove: boolean
  readonly isCheckingCode: boolean
}

const useDeviceApprovalAction = (code: string) => {
  const [isAuthorizing, setIsAuthorizing] = React.useState(false)
  const [didApprove, setDidApprove] = React.useState(false)

  const authorize = async () => {
    if (!code) {
      return
    }
    setIsAuthorizing(true)
    try {
      await authorizeDeviceCode(code)
      setDidApprove(true)
    } catch (error) {
      showErrorToast({
        title: "Couldn’t approve the login",
        description: getUserFacingErrorMessage(
          error,
          "The login couldn’t be approved. Check the code, then try again."
        ),
      })
    } finally {
      setIsAuthorizing(false)
    }
  }

  return { authorize, didApprove, isAuthorizing }
}

const getDeviceApprovalHeading = (
  didApprove: boolean,
  isCheckingCode: boolean,
  canApprove: boolean
): string => {
  if (didApprove) {
    return "Login approved"
  }
  if (isCheckingCode || canApprove) {
    return "Approve login"
  }
  return "Code invalid or expired"
}

const DeviceApprovalStatusMessage = ({
  code,
  canApprove,
  didApprove,
  isCheckingCode,
}: DeviceApprovalStatusMessageProps) => {
  if (didApprove) {
    return (
      <p className="text-balance text-lg text-muted-foreground">
        The other device is now logged in.
      </p>
    )
  }

  if (isCheckingCode) {
    return (
      <div
        className="flex items-center justify-center gap-2 text-muted-foreground"
        role="status"
      >
        <Spinner aria-hidden="true" />
        <span>Checking code…</span>
      </div>
    )
  }

  return (
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
  )
}

const DeviceApproval = () => {
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
  const { authorize, didApprove, isAuthorizing } = useDeviceApprovalAction(code)
  const heading = getDeviceApprovalHeading(
    didApprove,
    isCheckingCode,
    canApprove
  )

  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <div className="flex-1 py-6 pb-16 md:py-8 md:pb-8">
        <FieldSet className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 text-center">
            <LynvoLink className="text-lg font-medium text-foreground no-underline hover:text-foreground hover:no-underline focus-visible:no-underline" />
            <h1 className="text-4xl font-normal tracking-tight">{heading}</h1>
            <DeviceApprovalStatusMessage
              code={code}
              canApprove={canApprove}
              didApprove={didApprove}
              isCheckingCode={isCheckingCode}
            />
          </div>

          <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
            {didApprove ? (
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
                    disabled={isAuthorizing}
                    onClick={() => void authorize()}
                  >
                    {isAuthorizing && (
                      <Spinner data-icon="inline-start" aria-hidden="true" />
                    )}
                    Approve login
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

export default DeviceApproval
