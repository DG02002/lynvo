import {
  ServerRouter,
  type EntryContext,
  type RouterContextProvider,
} from "react-router"
import { isbot } from "isbot"
import { renderToReadableStream } from "react-dom/server"
import { CLIENT_PROFILE_BOOTSTRAP_SCRIPT } from "~/lib/client-profile"
import { createContentSecurityPolicy } from "~/lib/content-security-policy"
import { THEME_BOOTSTRAP_SCRIPT } from "~/lib/theme"

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const NEXT_THEMES_BOOTSTRAP_HASH =
  "gb6dNSVZKu5ARVoUjTW1x8JnToWeIcP2K0lB6J49wPA="

const getInlineScriptHash = async (script: string) =>
  toBase64(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(script))
    )
  )

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: RouterContextProvider
) {
  let shellRendered = false
  const userAgent = request.headers.get("user-agent")
  const cspNonce = crypto.randomUUID()
  const [clientProfileBootstrapHash, themeBootstrapHash, body] =
    await Promise.all([
      getInlineScriptHash(CLIENT_PROFILE_BOOTSTRAP_SCRIPT),
      getInlineScriptHash(THEME_BOOTSTRAP_SCRIPT),
      renderToReadableStream(
        <ServerRouter
          context={routerContext}
          url={request.url}
          nonce={cspNonce}
        />,
        {
          nonce: cspNonce,
          onError(cause: unknown) {
            responseStatusCode = 500
            // Log streaming rendering errors from inside the shell.  Don't log
            // errors encountered during initial shell rendering since they'll
            // reject and get logged in handleDocumentRequest.
            if (shellRendered) {
              console.error(cause)
            }
          },
        }
      ),
    ])
  shellRendered = true

  // Ensure requests from bots and SPA Mode renders wait for all content to load before responding
  // https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
  if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
    await body.allReady
  }

  responseHeaders.set("Content-Type", "text/html")
  responseHeaders.set("X-Content-Type-Options", "nosniff")
  responseHeaders.set("X-Frame-Options", "DENY")
  responseHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin")
  responseHeaders.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), vr=(), accelerometer=(), gyroscope=(), magnetometer=()"
  )
  responseHeaders.set(
    "Content-Security-Policy",
    createContentSecurityPolicy(request.url, import.meta.env.DEV, cspNonce, [
      clientProfileBootstrapHash,
      themeBootstrapHash,
      NEXT_THEMES_BOOTSTRAP_HASH,
    ])
  )
  responseHeaders.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  )
  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  })
}
