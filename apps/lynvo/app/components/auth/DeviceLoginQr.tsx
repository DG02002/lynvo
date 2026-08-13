import * as React from "react"
import { QRCodeCanvas } from "qrcode.react"
import { useQuery } from "@tanstack/react-query"
import { Effect } from "effect"
import { Spinner } from "~/components/ui/spinner"
import { Button } from "~/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Refresh01Icon } from "@hugeicons/core-free-icons"
import { signInWithConvexAuthHttp } from "~/lib/convex-auth-http"
import { createDeviceCode } from "./device-code"
import { useExpiryClock } from "./use-expiry-clock"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"
import { getBrowserDeviceName } from "~/lib/device-name"
import { client } from "~/lib/effect/api/client"
import { DEVICE_AUTH_STATUS_POLL_INTERVAL_MS } from "~/lib/constants"

type Phase = "loading" | "pending" | "approved" | "expired" | "error"

interface DeviceLoginState {
  code: string | null
  pollSecret: string | null
  expiresAt?: number
  deviceName: string
  hasError: boolean
  errorMessage: string | null
  isGenerating: boolean
}

interface DeviceLoginAction {
  kind: "generating" | "generated" | "failed"
  code?: string
  pollSecret?: string
  expiresAt?: number
  deviceName?: string
  errorMessage?: string
}

const INITIAL_DEVICE_LOGIN_STATE: DeviceLoginState = {
  code: null,
  pollSecret: null,
  deviceName: "",
  hasError: false,
  errorMessage: null,
  isGenerating: true,
}

const reduceDeviceLoginState = (
  state: DeviceLoginState,
  action: DeviceLoginAction
): DeviceLoginState => {
  switch (action.kind) {
    case "generating":
      return {
        ...state,
        hasError: false,
        errorMessage: null,
        isGenerating: true,
      }
    case "generated":
      return {
        code: action.code ?? null,
        pollSecret: action.pollSecret ?? null,
        expiresAt: action.expiresAt,
        deviceName: action.deviceName ?? "",
        hasError: false,
        errorMessage: null,
        isGenerating: false,
      }
    case "failed":
      return {
        ...state,
        hasError: true,
        errorMessage:
          action.errorMessage ??
          "The device couldn’t log in. Generate a new code, then try again.",
        isGenerating: false,
      }
  }
}

export function DeviceLoginQr() {
  const [state, dispatch] = React.useReducer(
    reduceDeviceLoginState,
    INITIAL_DEVICE_LOGIN_STATE
  )
  const {
    code,
    pollSecret,
    expiresAt,
    deviceName,
    hasError,
    errorMessage,
    isGenerating,
  } = state
  const codeRef = React.useRef<string | null>(null)
  const exchangeAttemptIdRef = React.useRef<string | null>(null)
  const { data: status } = useQuery({
    queryKey: ["device-auth-status", code, pollSecret],
    queryFn: () =>
      Effect.runPromise(
        client.device.status({
          query: { code: code ?? "", pollSecret: pollSecret ?? "" },
        })
      ),
    enabled: Boolean(code && pollSecret),
    refetchInterval: DEVICE_AUTH_STATUS_POLL_INTERVAL_MS,
  })
  const hasExpired = useExpiryClock(expiresAt)
  const hasSignedInRef = React.useRef(false)
  const origin = React.useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  )

  const fetchCode = React.useCallback(async () => {
    dispatch({ kind: "generating" })
    hasSignedInRef.current = false
    try {
      const nextDeviceName = getBrowserDeviceName()
      const result = await createDeviceCode(nextDeviceName)
      codeRef.current = result.code
      exchangeAttemptIdRef.current = crypto.randomUUID()
      dispatch({
        kind: "generated",
        code: result.code,
        pollSecret: result.pollSecret,
        expiresAt: result.expiresAt,
        deviceName: result.deviceName,
      })
    } catch (error) {
      dispatch({
        kind: "failed",
        errorMessage: getUserFacingErrorMessage(
          error,
          "The activation code couldn’t be created. Try generating a new code."
        ),
      })
    }
  }, [])

  React.useEffect(() => {
    void fetchCode()
  }, [fetchCode])

  React.useEffect(() => {
    if (
      codeRef.current &&
      (status?.status === "authorized" || status?.status === "consumed") &&
      !hasSignedInRef.current
    ) {
      hasSignedInRef.current = true
      const currentCode = codeRef.current
      void (async () => {
        const result = await signInWithConvexAuthHttp("credentials", {
          flow: "device",
          code: currentCode,
          pollSecret: pollSecret ?? "",
          deviceName,
          exchangeAttemptId: exchangeAttemptIdRef.current ?? "",
        })
        if (!result.signingIn) {
          throw new Error(
            "This device couldn’t log in. Generate a new code, then try again."
          )
        }
        window.location.href = "/save?device_setup=true"
      })().catch((error) => {
        hasSignedInRef.current = false
        dispatch({
          kind: "failed",
          errorMessage: getUserFacingErrorMessage(
            error,
            "This device couldn’t log in. Retrying the approved code…"
          ),
        })
      })
    }
  }, [deviceName, pollSecret, status])

  let phase: Phase = "loading"
  if (hasError) {
    phase = "error"
  } else if (isGenerating) {
    phase = "loading"
  } else if (hasExpired) {
    phase = "expired"
  } else if (status?.status === "invalid") {
    phase = "error"
  } else if (status?.status === "authorized" || hasSignedInRef.current) {
    phase = "approved"
  } else if (status?.status === "pending" || (code && !status)) {
    phase = "pending"
  }

  if (phase === "loading") {
    return (
      <div
        data-device-login-state="loading"
        className="flex items-center justify-center gap-2 p-10"
        role="status"
      >
        <Spinner />
        <span>Creating activation code…</span>
      </div>
    )
  }

  if (phase === "expired" || phase === "error") {
    return (
      <div
        data-device-login-state={phase}
        className="flex flex-col items-center justify-center gap-4 p-6 text-center"
      >
        <p className="text-destructive">
          {phase === "expired"
            ? "Code expired. Generate a new code."
            : (errorMessage ??
              "The device couldn’t log in. Generate a new code, then try again.")}
        </p>
        <Button onClick={() => void fetchCode()} variant="outline" size="sm">
          <HugeiconsIcon icon={Refresh01Icon} className="mr-2 size-4" />
          Generate new code
        </Button>
      </div>
    )
  }

  if (!code || !origin) {
    return null
  }

  const authUrl = `${origin}/auth/device?user_code=${code}`

  return (
    <div
      data-device-login-qr
      className="flex flex-col items-center gap-6 text-center"
    >
      <div data-device-login-qr-image>
        <QRCodeCanvas
          value={authUrl}
          size={180}
          level="M"
          marginSize={2}
          bgColor="#ffffff"
          fgColor="#000000"
        />
      </div>

      <div
        data-device-login-code
        className="flex flex-col items-center gap-2 text-center"
      >
        <p className="text-sm text-muted-foreground">
          Confirm that the same activation code appears on the other device.
        </p>
        <p
          aria-label="Login verification code"
          className="my-8 text-3xl font-normal tracking-[0.16em] text-foreground tabular-nums sm:text-4xl"
        >
          {code}
        </p>
      </div>
    </div>
  )
}
