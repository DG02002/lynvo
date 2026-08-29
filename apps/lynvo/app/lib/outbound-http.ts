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
}

export class OutboundHttpError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "OutboundHttpError"
    this.code = code
  }
}

const isBlockedIpv4 = (hostname: string): boolean => {
  const octets = hostname.split(".").map(Number)
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false
  }
  const [first, second, third] = octets
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && third === 0) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  )
}

const isBlockedIpv6 = (hostname: string): boolean => {
  if (!hostname.startsWith("[") || !hostname.endsWith("]")) {
    return false
  }
  const address = hostname.slice(1, -1).toLowerCase()
  const firstGroup = Number.parseInt(address.split(":")[0] || "0", 16)
  return (
    address === "::" ||
    address === "::1" ||
    address.startsWith("::ffff:") ||
    (firstGroup & 0xfe00) === 0xfc00 ||
    (firstGroup & 0xffc0) === 0xfe80 ||
    (firstGroup & 0xff00) === 0xff00 ||
    address.startsWith("2001:db8:")
  )
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
  const hostname = destination.hostname.toLowerCase()
  const isLocalHostname =
    hostname === "localhost" || hostname.endsWith(".localhost")
  if (
    (isLocalHostname && !options.allowLocalDevelopment) ||
    isBlockedIpv4(hostname) ||
    isBlockedIpv6(hostname)
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

const fetchWithOutboundRedirects = async ({
  requestFetch,
  destination,
  options,
  transportOptions,
  protectedOrigin,
}: OutboundFetchContext): Promise<Response> => {
  let requestState = createOutboundRequestState(
    destination,
    options,
    transportOptions
  )
  for (
    let redirectCount = 0;
    redirectCount <= OUTBOUND_HTTP_MAX_REDIRECTS;
    redirectCount += 1
  ) {
    const response = await fetchOutboundRequest({
      requestFetch,
      requestState,
      options,
    })
    if (!isRedirect(response.status)) {
      return readFinalOutboundResponse(response, options)
    }
    requestState = getRedirectRequestState({
      response,
      redirectCount,
      requestState,
      options,
      transportOptions,
      protectedOrigin,
    })
  }
  throw new OutboundHttpError(
    "TOO_MANY_REDIRECTS",
    "Outbound redirect limit exceeded"
  )
}

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
