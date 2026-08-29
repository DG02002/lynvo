import * as React from "react"
import { QRCodeCanvas } from "qrcode.react"
import { Spinner } from "~/components/spinner"
import { Button } from "~/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Refresh01Icon } from "@hugeicons/core-free-icons"
import { createDeviceCode } from "./device-code"
import {
  claimDeviceExchange,
  finalizeDeviceExchangeOverHttp,
  readDeviceCodeStatus,
  type DeviceCodeStatus,
} from "./device-auth-http"
import { useExpiryClock } from "./use-expiry-clock"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"
import { getBrowserDeviceName } from "~/lib/device-name"
import { DEVICE_AUTH_STATUS_POLL_INTERVAL_MS } from "~/lib/constants"
import { useAsyncResource } from "~/hooks/use-async-resource"

type Phase = "loading" | "pending" | "approved" | "expired" | "error"

interface DeviceLoginPhaseInput {
  readonly code: string | null
  readonly hasError: boolean
  readonly isGenerating: boolean
  readonly hasExpired: boolean
  readonly status: DeviceCodeStatus | undefined
  readonly hasSignedIn: boolean
}

interface DeviceLoginController {
  readonly code: string | null
  readonly origin: string
  readonly errorMessage: string | null
  readonly phase: Phase
  readonly fetchCode: () => Promise<void>
}

interface DeviceLoginState {
  code: string | null
  pollSecret: string | null
  expiresAt?: number
  hasError: boolean
  errorMessage: string | null
  isGenerating: boolean
  hasSignedIn: boolean
}

interface DeviceLoginAction {
  kind: "generating" | "generated" | "approved" | "failed"
  code?: string
  pollSecret?: string
  expiresAt?: number
  errorMessage?: string
}

const INITIAL_DEVICE_LOGIN_STATE: DeviceLoginState = {
  code: null,
  pollSecret: null,
  hasError: false,
  errorMessage: null,
  isGenerating: true,
  hasSignedIn: false,
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
        hasSignedIn: false,
      }
    case "generated":
      return {
        code: action.code ?? null,
        pollSecret: action.pollSecret ?? null,
        expiresAt: action.expiresAt,
        hasError: false,
        errorMessage: null,
        isGenerating: false,
        hasSignedIn: false,
      }
    case "approved":
      return {
        ...state,
        hasSignedIn: true,
      }
    case "failed":
      return {
        ...state,
        hasError: true,
        errorMessage:
          action.errorMessage ??
          "The device couldn’t log in. Generate a new code, then try again.",
        isGenerating: false,
        hasSignedIn: false,
      }
  }
}

const getDeviceLoginPhase = ({
  code,
  hasError,
  isGenerating,
  hasExpired,
  status,
  hasSignedIn,
}: DeviceLoginPhaseInput): Phase => {
  switch (true) {
    case hasError:
      return "error"
    case isGenerating:
      return "loading"
    case hasExpired:
      return "expired"
    case status?.status === "invalid":
      return "error"
    case status?.status === "authorized" || hasSignedIn:
      return "approved"
    case status?.status === "pending" || (code && !status):
      return "pending"
    default:
      return "loading"
  }
}

interface DeviceLoginCodeController {
  readonly state: DeviceLoginState
  readonly fetchCode: () => Promise<void>
  readonly exchangeApprovedDevice: (pollSecret: string) => Promise<void>
}

interface DeviceExchangeRequest {
  readonly code: string
  readonly pollSecret: string
  readonly attemptId: string
  readonly generation: number
}

const completeDeviceExchange = async ({
  code,
  pollSecret,
  attemptId,
  generation,
}: DeviceExchangeRequest) => {
  const claim = await claimDeviceExchange({
    code,
    pollSecret,
    attemptId,
    generation,
  })
  await finalizeDeviceExchangeOverHttp({
    code,
    pollSecret,
    attemptId,
    generation,
    sessionId: claim.sessionId,
  })
}

const useDeviceLoginCode = (): DeviceLoginCodeController => {
  const [state, dispatch] = React.useReducer(
    reduceDeviceLoginState,
    INITIAL_DEVICE_LOGIN_STATE
  )
  const codeRef = React.useRef<string | null>(null)
  const exchangeAttemptIdRef = React.useRef<string | null>(null)
  const exchangeGenerationRef = React.useRef(1)
  const hasSignedInRef = React.useRef(false)

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

  const handleExchangeFailure = React.useCallback((errorMessage: string) => {
    hasSignedInRef.current = false
    dispatch({
      kind: "failed",
      errorMessage,
    })
  }, [])

  const exchangeApprovedDevice = React.useCallback(
    async (currentPollSecret: string) => {
      if (
        !codeRef.current ||
        !exchangeAttemptIdRef.current ||
        hasSignedInRef.current
      ) {
        return
      }

      hasSignedInRef.current = true
      const currentCode = codeRef.current
      const currentExchangeAttemptId = exchangeAttemptIdRef.current
      dispatch({ kind: "approved" })

      try {
        await completeDeviceExchange({
          code: currentCode,
          pollSecret: currentPollSecret,
          attemptId: currentExchangeAttemptId,
          generation: exchangeGenerationRef.current,
        })
        window.location.href = "/save?device_setup=true"
      } catch (error) {
        handleExchangeFailure(
          getUserFacingErrorMessage(
            error,
            "This device couldn’t log in. Retrying the approved code…"
          )
        )
      }
    },
    [handleExchangeFailure]
  )

  React.useEffect(() => {
    void fetchCode()
  }, [fetchCode])

  return {
    state,
    fetchCode,
    exchangeApprovedDevice,
  }
}

const useDeviceLogin = (): DeviceLoginController => {
  const { state, fetchCode, exchangeApprovedDevice } = useDeviceLoginCode()
  const {
    code,
    pollSecret,
    expiresAt,
    hasError,
    errorMessage,
    isGenerating,
    hasSignedIn,
  } = state
  const { data: status } = useAsyncResource(
    () =>
      code && pollSecret
        ? readDeviceCodeStatus({
            code: code ?? "",
            pollSecret: pollSecret ?? "",
          })
        : Promise.resolve(undefined),
    [code, pollSecret],
    { pollIntervalMs: DEVICE_AUTH_STATUS_POLL_INTERVAL_MS }
  )
  const hasExpired = useExpiryClock(expiresAt)
  const origin = React.useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  )

  React.useEffect(() => {
    if (status?.status === "authorized" || status?.status === "consumed") {
      void exchangeApprovedDevice(pollSecret ?? "")
    }
  }, [exchangeApprovedDevice, pollSecret, status])

  const phase = getDeviceLoginPhase({
    code,
    hasError,
    isGenerating,
    hasExpired,
    status,
    hasSignedIn,
  })

  return { code, errorMessage, fetchCode, origin, phase }
}

export const DeviceLoginQr = () => {
  const { code, errorMessage, fetchCode, origin, phase } = useDeviceLogin()

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
