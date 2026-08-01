import * as React from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { Effect } from "effect"
import { Button } from "~/components/ui/button"
import { toast } from "sonner"
import { FieldSet } from "~/components/field"
import { LynvoLink } from "~/components/LynvoLink"
import { authPaths, policyPaths } from "~/lib/paths"
import { useExpiryClock } from "./use-expiry-clock"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"
import { client } from "~/lib/effect/api/client"

interface DeviceApprovalProps {
  user?: { username: string } | null
}

export default function DeviceApproval({ user }: DeviceApprovalProps) {
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  )
  const code = params.get("code") ?? ""
  const { data: codeRecord } = useQuery({
    queryKey: ["device-auth-approval", code],
    queryFn: () =>
      Effect.runPromise(client.device.approval({ query: { code } })),
    enabled: code.length === 8,
  })
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
      await Effect.runPromise(client.device.authorize({ payload: { code } }))
      setSuccess(true)
      toast.success("Device login approved")
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(
          error,
          "This device couldn’t be approved. Check the code, then try again."
        )
      )
    } finally {
      setLoading(false)
    }
  }

  const heading = success
    ? "Device login approved"
    : canApprove
      ? `Approve login for ${codeRecord.deviceName}?`
      : "Match the code on your device"

  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <div className="flex-1 py-6 pb-16 md:py-8 md:pb-8">
        <FieldSet className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 text-center">
            <LynvoLink className="text-lg font-medium text-foreground no-underline hover:text-foreground hover:no-underline focus-visible:no-underline" />
            <h1 className="text-4xl font-normal tracking-tight">{heading}</h1>
            {success ? (
              <p className="text-balance text-lg text-muted-foreground">
                You can close this page.
              </p>
            ) : (
              <p className="text-balance text-lg text-muted-foreground">
                {canApprove
                  ? `Lynvo will log in ${codeRecord.deviceName} as ${user?.username}. Confirm only if the code on the other device is ${code}.`
                  : "The code is invalid or expired."}
              </p>
            )}
          </div>

          {!success && (
            <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
              <Button
                type="button"
                className="h-13.5 w-full"
                disabled={!canApprove || loading}
                onClick={() => void handleAuthorize()}
              >
                {loading ? "Approving login…" : "Approve login"}
              </Button>
              <Button
                variant="secondary"
                className="h-13.5 w-full"
                render={
                  <Link to={authPaths.signIn} viewTransition>
                    Back to log in
                  </Link>
                }
              />
            </div>
          )}

          <div className="mt-3 hidden space-x-1 text-center text-xs text-muted-foreground md:block">
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
        </FieldSet>
      </div>
    </div>
  )
}
