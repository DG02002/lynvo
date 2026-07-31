import * as React from "react"

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string
          action: string
          theme?: "auto" | "light" | "dark"
          size?: "normal" | "compact" | "flexible"
          callback: (token: string) => void
          "error-callback"?: () => void
          "expired-callback"?: () => void
        }
      ) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
  }
}

export interface TurnstileHandle {
  reset: () => void
}

interface TurnstileProps {
  action: "lynvo-sign-in" | "lynvo-sign-up"
  onVerify: (token: string) => void
  onError?: () => void
  ref?: React.Ref<TurnstileHandle>
}

const loadTurnstileScript = () => {
  const existing = document.querySelector<HTMLScriptElement>(
    'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"]'
  )
  if (existing) {
    return
  }
  const script = document.createElement("script")
  script.src =
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
  script.async = true
  script.defer = true
  document.head.appendChild(script)
}

const getTurnstileSiteKey = () => {
  if (import.meta.env.DEV || typeof document === "undefined") {
    return ""
  }
  return (
    document
      .querySelector('meta[name="turnstile-site-key"]')
      ?.getAttribute("content") ?? ""
  )
}

export const Turnstile = ({
  action,
  onVerify,
  onError,
  ref,
}: TurnstileProps) => {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const widgetIdRef = React.useRef<string | null>(null)
  const siteKey = getTurnstileSiteKey()

  React.useImperativeHandle(ref, () => ({
    reset() {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current)
      }
    },
  }))

  React.useEffect(() => {
    if (!siteKey) {
      return
    }
    loadTurnstileScript()
  }, [siteKey])

  React.useEffect(() => {
    if (import.meta.env.DEV || !siteKey || !containerRef.current) {
      return
    }
    let cancelled = false
    const render = () => {
      if (
        cancelled ||
        !window.turnstile ||
        !containerRef.current ||
        widgetIdRef.current
      ) {
        return
      }
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action,
        theme: "auto",
        size: "flexible",
        callback: onVerify,
        "error-callback": () => {
          onVerify("")
          if (widgetIdRef.current) {
            window.turnstile?.reset(widgetIdRef.current)
          }
          onError?.()
        },
        "expired-callback": () => {
          onVerify("")
          if (widgetIdRef.current) {
            window.turnstile?.reset(widgetIdRef.current)
          }
        },
      })
    }
    const interval = window.setInterval(render, 100)
    render()
    return () => {
      cancelled = true
      window.clearInterval(interval)
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
      }
      widgetIdRef.current = null
    }
  }, [action, siteKey, onVerify, onError])

  if (import.meta.env.DEV) {
    return (
      <div className="flex flex-col gap-2 py-2">
        <div
          className="rounded border border-dashed border-muted-foreground/50 p-2 text-center text-xs text-muted-foreground"
          data-turnstile-action={action}
        >
          Turnstile bypassed in dev mode
        </div>
      </div>
    )
  }

  if (!siteKey) {
    return null
  }

  return (
    <div className="flex flex-col gap-2 py-2">
      <span className="text-sm">Let us know you&apos;re human</span>
      <div ref={containerRef} data-turnstile-action={action} />
    </div>
  )
}
