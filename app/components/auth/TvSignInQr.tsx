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

type Phase = "loading" | "pending" | "approved" | "expired" | "error"

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
  const generateCode = useMutation(api.tv.generateCode)
  const setCurrentSessionDevice = useMutation(api.users.setCurrentSessionDevice)
  const [code, setCode] = React.useState<string | null>(null)
  const codeRef = React.useRef<string | null>(null)
  const [deviceName, setDeviceName] = React.useState("")
  const [hasError, setHasError] = React.useState(false)
  const [isGenerating, setIsGenerating] = React.useState(true)
  const status = useQuery(api.tv.getStatus, code ? { code } : "skip")
  const hasSignedInRef = React.useRef(false)
  const origin = React.useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  )

  const fetchCode = React.useCallback(async () => {
    setIsGenerating(true)
    setHasError(false)
    hasSignedInRef.current = false
    try {
      const nextDeviceName = detectDeviceName()
      const result = await generateCode({ deviceName: nextDeviceName })
      setCode(result.code)
      codeRef.current = result.code
      setDeviceName(result.deviceName)
      setIsGenerating(false)
    } catch {
      setHasError(true)
      setIsGenerating(false)
    }
  }, [generateCode])

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
      })().catch(() => {
        setHasError(true)
      })
    }
  }, [convexUrl, deviceName, setCurrentSessionDevice, status])

  let phase: Phase = "loading"
  if (hasError) {
    phase = "error"
  } else if (isGenerating) {
    phase = "loading"
  } else if (status?.status === "expired") {
    phase = "expired"
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
        <p className="text-destructive">Code expired or could not load.</p>
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
