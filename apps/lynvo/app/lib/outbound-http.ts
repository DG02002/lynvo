import {
  isBlockedIpUrl,
  isLocalUrl,
} from "@dg02002/lynvo-plugin-server-protocol"
import {
  OUTBOUND_HTTP_MAX_REDIRECTS,
  OUTBOUND_HTTP_MAX_RESPONSE_BYTES,
  OUTBOUND_HTTP_TIMEOUT_MS,
} from "./constants"

declare global {
  interface OutboundHttpTransportOptions {
    fetch?: typeof globalThis.fetch
    allowLocalDevelopment?: boolean
  }

  interface OutboundHttpRequestOptions extends RequestInit {
    protectedOrigin?: string
    allowedProtocols?: readonly string[]
    timeoutMs?: number
    maximumResponseBytes?: number
    responseBodyMode?: "read" | "discard"
  }

  interface OutboundHttpTransport {
    fetch: (
      destination: string | URL,
      options?: OutboundHttpRequestOptions
    ) => Promise<Response>
  }

  interface OutboundRequestState {
    currentUrl: URL
    method: string
    body: OutboundHttpRequestOptions["body"]
    headers: Headers
  }

  interface OutboundRequestAttempt {
    requestFetch: typeof globalThis.fetch
    requestState: OutboundRequestState
    options: OutboundHttpRequestOptions
  }

  interface OutboundRedirectInput {
    response: Response
    redirectCount: number
    requestState: OutboundRequestState
    options: OutboundHttpRequestOptions
    transportOptions: OutboundHttpTransportOptions
    protectedOrigin: string | undefined
  }

  interface OutboundFetchContext {
    requestFetch: typeof globalThis.fetch
    destination: string | URL
    options: OutboundHttpRequestOptions
    transportOptions: OutboundHttpTransportOptions
    protectedOrigin: string | undefined
  }

  interface OutboundRedirectFollowState {
    requestFetch: typeof globalThis.fetch
    requestState: OutboundRequestState
    options: OutboundHttpRequestOptions
    transportOptions: OutboundHttpTransportOptions
    protectedOrigin: string | undefined
    redirectCount: number
  }
}

export class OutboundHttpError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "OutboundHttpError"
    this.code = code
  }
}

export const validateOutboundUrl = (
  value: string | URL,
  options: {
    allowedProtocols?: readonly string[]
    allowLocalDevelopment?: boolean
  } = {}
): URL => {
  let destination: URL
  try {
    destination = new URL(value)
  } catch {
    throw new OutboundHttpError("INVALID_URL", "Invalid outbound URL")
  }
  const allowedProtocols = options.allowedProtocols ?? ["http:", "https:"]
  if (!allowedProtocols.includes(destination.protocol)) {
    throw new OutboundHttpError(
      "UNSAFE_DESTINATION",
      "Outbound protocol is not allowed"
    )
  }
  if (destination.username || destination.password) {
    throw new OutboundHttpError(
      "UNSAFE_DESTINATION",
      "Credentials are not allowed in outbound URLs"
    )
  }
  const isLocalDestination = isLocalUrl(destination)
  if (
    (isLocalDestination && !options.allowLocalDevelopment) ||
    isBlockedIpUrl(destination)
  ) {
    throw new OutboundHttpError(
      "UNSAFE_DESTINATION",
      "Outbound destination is not public"
    )
  }
  return destination
}

const isRedirect = (status: number): boolean =>
  [301, 302, 303, 307, 308].includes(status)

const createOutboundRequestState = (
  destination: string | URL,
  options: OutboundHttpRequestOptions,
  transportOptions: OutboundHttpTransportOptions
): OutboundRequestState => ({
  currentUrl: validateOutboundUrl(destination, {
    allowedProtocols: options.allowedProtocols,
    allowLocalDevelopment: transportOptions.allowLocalDevelopment,
  }),
  method: options.method ?? "GET",
  body: options.body,
  headers: new Headers(options.headers),
})

const fetchOutboundRequest = async ({
  requestFetch,
  requestState,
  options,
}: OutboundRequestAttempt): Promise<Response> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? OUTBOUND_HTTP_TIMEOUT_MS
  )
  try {
    return await requestFetch(
      new Request(requestState.currentUrl, {
        ...options,
        method: requestState.method,
        body: requestState.body,
        headers: requestState.headers,
        redirect: "manual",
        signal: controller.signal,
      })
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

const readFinalOutboundResponse = async (
  response: Response,
  options: OutboundHttpRequestOptions
): Promise<Response> => {
  if (options.responseBodyMode === "discard") {
    await response.body?.cancel()
    return new Response(null, response)
  }
  const responseBody = await response.arrayBuffer()
  if (
    responseBody.byteLength >
    (options.maximumResponseBytes ?? OUTBOUND_HTTP_MAX_RESPONSE_BYTES)
  ) {
    throw new OutboundHttpError(
      "RESPONSE_TOO_LARGE",
      "Outbound response exceeded the byte limit"
    )
  }
  return new Response(responseBody, response)
}

const getRedirectRequestState = ({
  response,
  redirectCount,
  requestState,
  options,
  transportOptions,
  protectedOrigin,
}: OutboundRedirectInput): OutboundRequestState => {
  if (redirectCount === OUTBOUND_HTTP_MAX_REDIRECTS) {
    throw new OutboundHttpError(
      "TOO_MANY_REDIRECTS",
      "Outbound redirect limit exceeded"
    )
  }
  const location = response.headers.get("Location")
  if (!location) {
    throw new OutboundHttpError(
      "INVALID_REDIRECT",
      "Outbound redirect is missing a destination"
    )
  }
  const nextUrl = validateOutboundUrl(
    new URL(location, requestState.currentUrl),
    {
      allowedProtocols: options.allowedProtocols,
      allowLocalDevelopment: transportOptions.allowLocalDevelopment,
    }
  )
  if (protectedOrigin && nextUrl.origin !== protectedOrigin) {
    throw new OutboundHttpError(
      "CROSS_ORIGIN_REDIRECT",
      "Protected outbound requests cannot redirect across origins"
    )
  }
  const headers = new Headers(requestState.headers)
  if (nextUrl.origin !== requestState.currentUrl.origin) {
    headers.delete("Authorization")
    headers.delete("Cookie")
    headers.delete("Proxy-Authorization")
  }
  const shouldResetMethod =
    response.status === 303 && requestState.method !== "HEAD"
  return {
    currentUrl: nextUrl,
    method: shouldResetMethod ? "GET" : requestState.method,
    body: shouldResetMethod ? undefined : requestState.body,
    headers,
  }
}

const followOutboundRedirects = async ({
  requestFetch,
  requestState,
  options,
  transportOptions,
  protectedOrigin,
  redirectCount,
}: OutboundRedirectFollowState): Promise<Response> => {
  const response = await fetchOutboundRequest({
    requestFetch,
    requestState,
    options,
  })
  if (!isRedirect(response.status)) {
    return readFinalOutboundResponse(response, options)
  }
  return followOutboundRedirects({
    requestFetch,
    requestState: getRedirectRequestState({
      response,
      redirectCount,
      requestState,
      options,
      transportOptions,
      protectedOrigin,
    }),
    options,
    transportOptions,
    protectedOrigin,
    redirectCount: redirectCount + 1,
  })
}

const fetchWithOutboundRedirects = async ({
  requestFetch,
  destination,
  options,
  transportOptions,
  protectedOrigin,
}: OutboundFetchContext): Promise<Response> =>
  followOutboundRedirects({
    requestFetch,
    requestState: createOutboundRequestState(
      destination,
      options,
      transportOptions
    ),
    options,
    transportOptions,
    protectedOrigin,
    redirectCount: 0,
  })

export const createOutboundHttpTransport = (
  transportOptions: OutboundHttpTransportOptions = {}
): OutboundHttpTransport => ({
  fetch: async (destination, options = {}) => {
    const protectedOrigin = options.protectedOrigin
      ? new URL(options.protectedOrigin).origin
      : undefined
    return fetchWithOutboundRedirects({
      requestFetch: transportOptions.fetch ?? globalThis.fetch,
      destination,
      options,
      transportOptions,
      protectedOrigin,
    })
  },
})
