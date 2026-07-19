import type { EntryContext, RouterContextProvider } from "react-router"
import { ServerRouter } from "react-router"
import { isbot } from "isbot"
import { renderToReadableStream } from "react-dom/server"

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: RouterContextProvider
) {
  let shellRendered = false
  const userAgent = request.headers.get("user-agent")

  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      onError(error: unknown) {
        responseStatusCode = 500
        // Log streaming rendering errors from inside the shell.  Don't log
        // errors encountered during initial shell rendering since they'll
        // reject and get logged in handleDocumentRequest.
        if (shellRendered) {
          console.error(error)
        }
      },
    }
  )
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
  const convexDevelopmentSources = import.meta.env.DEV
    ? " http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*"
    : ""
  responseHeaders.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https: http://localhost:* http://127.0.0.1:*; connect-src 'self' https://challenges.cloudflare.com https://*.convex.cloud wss://*.convex.cloud${convexDevelopmentSources};`
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
