import * as React from "react"
import { QRCodeCanvas } from "qrcode.react"
import { useRouteLoaderData } from "react-router"
import { useMutation, useQuery } from "convex/react"
import { Spinner } from "~/components/ui/spinner"
import { Button } from "~/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Refresh01Icon } from "@hugeicons/core-free-icons"
import { api } from "../../../convex/_generated/api"
import { signInWithConvexAuthHttp } from "~/lib/convex-auth-http"
import { createDeviceCode } from "./device-code"
import { useExpiryClock } from "./use-expiry-clock"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"

type Phase = "loading" | "pending" | "approved" | "expired" | "error"

interface TvSignInState {
  code: string | null
  pollSecret: string | null
  expiresAt?: number
  deviceName: string
  hasError: boolean
  errorMessage: string | null
  isGenerating: boolean
}

interface TvSignInAction {
  kind: "generating" | "generated" | "failed"
  code?: string
  pollSecret?: string
  expiresAt?: number
  deviceName?: string
  errorMessage?: string
}

const INITIAL_TV_SIGN_IN_STATE: TvSignInState = {
  code: null,
  pollSecret: null,
  deviceName: "",
  hasError: false,
  errorMessage: null,
  isGenerating: true,
}

const reduceTvSignInState = (
  state: TvSignInState,
  action: TvSignInAction
): TvSignInState => {
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
          action.errorMessage ?? "Device sign-in failed. Try again.",
        isGenerating: false,
      }
  }
}

const detectDeviceName = () => {
  if (typeof navigator === "undefined") {
    return "Unknown Device"
  }
  const ua = navigator.userAgent
  const browser = ua.includes("Firefox")
    ? "Firefox"
    : ua.includes("Edg")
      ? "Edge"
      : ua.includes("Chrome")
        ? "Chrome"
        : ua.includes("Safari")
          ? "Safari"
          : "Browser"
  const os = ua.includes("Android")
    ? "Android"
    : ua.includes("iPhone") || ua.includes("iPad")
      ? "iOS"
      : ua.includes("Mac")
        ? "macOS"
        : ua.includes("Windows")
          ? "Windows"
          : ua.includes("Linux")
            ? "Linux"
            : "Device"
  return `${browser} on ${os}`
}

export function TvSignInQr() {
  const rootData = useRouteLoaderData("root") as
    | { convexUrl?: string }
    | undefined
  const convexUrl = rootData?.convexUrl ?? ""
  const setCurrentSessionDevice = useMutation(api.users.setCurrentSessionDevice)
  const [state, dispatch] = React.useReducer(
    reduceTvSignInState,
    INITIAL_TV_SIGN_IN_STATE
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
  const status = useQuery(
    api.tv.getStatus,
    code && pollSecret ? { code, pollSecret } : "skip"
  )
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
      const nextDeviceName = detectDeviceName()
      const result = await createDeviceCode(nextDeviceName)
      codeRef.current = result.code
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
          "Unable to create a device code. Try again."
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
      status?.status === "authorized" &&
      !hasSignedInRef.current
    ) {
      hasSignedInRef.current = true
      const currentCode = codeRef.current
      void (async () => {
        const result = await signInWithConvexAuthHttp(
          convexUrl,
          "credentials",
          {
            flow: "device",
            code: currentCode,
            pollSecret: pollSecret ?? "",
          }
        )
        if (!result.signingIn) {
          throw new Error(
            "Unable to sign in this device. Generate a new code and try again."
          )
        }
        window.setTimeout(() => {
          void setCurrentSessionDevice({ deviceName }).finally(() => {
            window.location.href = "/save?device_setup=true"
          })
        }, 250)
      })().catch((error) => {
        dispatch({
          kind: "failed",
          errorMessage: getUserFacingErrorMessage(
            error,
            "Unable to sign in this device. Generate a new code and try again."
          ),
        })
      })
    }
  }, [convexUrl, deviceName, pollSecret, setCurrentSessionDevice, status])

  let phase: Phase = "loading"
  if (hasError) {
    phase = "error"
  } else if (isGenerating) {
    phase = "loading"
  } else if (hasExpired) {
    phase = "expired"
  } else if (status?.status === "invalid" || status?.status === "consumed") {
    phase = "error"
  } else if (status?.status === "authorized" || hasSignedInRef.current) {
    phase = "approved"
  } else if (status?.status === "pending" || (code && !status)) {
    phase = "pending"
  }

  if (phase === "loading") {
    return (
      <div className="flex justify-center p-10">
        <Spinner />
      </div>
    )
  }

  if (phase === "expired" || phase === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-destructive">
          {phase === "expired"
            ? "Code expired. Generate a new code."
            : (errorMessage ?? "Device sign-in failed. Try again.")}
        </p>
        <Button onClick={() => void fetchCode()} variant="outline" size="sm">
          <HugeiconsIcon icon={Refresh01Icon} className="mr-2 size-4" /> Retry
        </Button>
      </div>
    )
  }

  if (!code || !origin) {
    return null
  }

  const authUrl = `${origin}/tv?code=${code}`

  return (
    <div className="flex flex-col items-start gap-6">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <QRCodeCanvas
          value={authUrl}
          size={180}
          level="M"
          marginSize={2}
          bgColor="#ffffff"
          fgColor="#000000"
        />
      </div>

      <div className="flex flex-col gap-2 text-left">
        <p className="text-sm text-muted-foreground">
          Or go to{" "}
          <span className="font-mono font-bold text-foreground">/tv</span> and
          enter:
        </p>
        <p className="font-mono text-3xl font-bold tracking-[0.2em] text-primary">
          {code}
        </p>
        <p className="text-xs text-muted-foreground">{deviceName}</p>
      </div>
    </div>
  )
}
