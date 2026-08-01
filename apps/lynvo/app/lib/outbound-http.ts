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
  }

  interface OutboundHttpTransport {
    fetch: (
      destination: string | URL,
      options?: OutboundHttpRequestOptions
    ) => Promise<Response>
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

export const createOutboundHttpTransport = (
  transportOptions: OutboundHttpTransportOptions = {}
): OutboundHttpTransport => ({
  fetch: async (destination, options = {}) => {
    const requestFetch = transportOptions.fetch ?? globalThis.fetch
    const protectedOrigin = options.protectedOrigin
      ? new URL(options.protectedOrigin).origin
      : undefined
    let currentUrl = validateOutboundUrl(destination, {
      allowedProtocols: options.allowedProtocols,
      allowLocalDevelopment: transportOptions.allowLocalDevelopment,
    })
    let method = options.method ?? "GET"
    let body = options.body
    const headers = new Headers(options.headers)

    for (
      let redirectCount = 0;
      redirectCount <= OUTBOUND_HTTP_MAX_REDIRECTS;
      redirectCount += 1
    ) {
      const controller = new AbortController()
      const timeoutId = setTimeout(
        () => controller.abort(),
        options.timeoutMs ?? OUTBOUND_HTTP_TIMEOUT_MS
      )
      let response: Response
      try {
        response = await requestFetch(
          new Request(currentUrl, {
            ...options,
            method,
            body,
            headers,
            redirect: "manual",
            signal: controller.signal,
          })
        )
      } finally {
        clearTimeout(timeoutId)
      }
      if (!isRedirect(response.status)) {
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
      const nextUrl = validateOutboundUrl(new URL(location, currentUrl), {
        allowedProtocols: options.allowedProtocols,
        allowLocalDevelopment: transportOptions.allowLocalDevelopment,
      })
      if (protectedOrigin && nextUrl.origin !== protectedOrigin) {
        throw new OutboundHttpError(
          "CROSS_ORIGIN_REDIRECT",
          "Protected outbound requests cannot redirect across origins"
        )
      }
      if (nextUrl.origin !== currentUrl.origin) {
        headers.delete("Authorization")
        headers.delete("Cookie")
        headers.delete("Proxy-Authorization")
      }
      if (response.status === 303 && method !== "HEAD") {
        method = "GET"
        body = undefined
      }
      currentUrl = nextUrl
    }
    throw new OutboundHttpError(
      "TOO_MANY_REDIRECTS",
      "Outbound redirect limit exceeded"
    )
  },
})
