import {
  fetchValidatedRedirects,
  isBlockedIpUrl,
  isLocalUrl,
  ValidatedFetchError,
} from "@dg02002/lynvo-plugin-server-protocol"
import {
  OUTBOUND_HTTP_MAX_REDIRECTS,
  OUTBOUND_HTTP_MAX_RESPONSE_BYTES,
  OUTBOUND_HTTP_TIMEOUT_MS,
} from "./constants"

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

const toOutboundHttpError = (error: ValidatedFetchError): never => {
  switch (error.code) {
    case "TOO_MANY_REDIRECTS":
      throw new OutboundHttpError(
        "TOO_MANY_REDIRECTS",
        "Outbound redirect limit exceeded"
      )
    case "INVALID_REDIRECT":
      throw new OutboundHttpError(
        "INVALID_REDIRECT",
        "Outbound redirect is missing a destination"
      )
    case "RESPONSE_TOO_LARGE":
      throw new OutboundHttpError(
        "RESPONSE_TOO_LARGE",
        "Outbound response exceeded the byte limit"
      )
  }
}

export const createOutboundHttpTransport = (
  transportOptions: OutboundHttpTransportOptions = {}
): OutboundHttpTransport => ({
  fetch: async (destination, options = {}) => {
    const {
      protectedOrigin: protectedOriginValue,
      allowedProtocols,
      timeoutMs,
      maximumResponseBytes,
      responseBodyMode,
      ...requestOptions
    } = options
    const protectedOrigin = protectedOriginValue
      ? new URL(protectedOriginValue).origin
      : undefined
    const validateUrl = (value: string | URL): URL =>
      validateOutboundUrl(value, {
        allowedProtocols,
        allowLocalDevelopment: transportOptions.allowLocalDevelopment,
      })
    const requestFetch = transportOptions.fetch ?? globalThis.fetch
    const fetchRequest: typeof globalThis.fetch = (input, init) =>
      requestFetch(new Request(input, init))

    try {
      return await fetchValidatedRedirects(destination, requestOptions, {
        fetch: fetchRequest,
        validateUrl,
        maxRedirects: OUTBOUND_HTTP_MAX_REDIRECTS,
        timeoutMs: timeoutMs ?? OUTBOUND_HTTP_TIMEOUT_MS,
        maximumResponseBytes:
          maximumResponseBytes ?? OUTBOUND_HTTP_MAX_RESPONSE_BYTES,
        responseBodyMode: responseBodyMode ?? "read",
        stripHeadersOnCrossOrigin: [
          "Authorization",
          "Cookie",
          "Proxy-Authorization",
        ],
        validateRedirect: protectedOrigin
          ? ({ nextUrl }) => {
              if (nextUrl.origin !== protectedOrigin) {
                throw new OutboundHttpError(
                  "CROSS_ORIGIN_REDIRECT",
                  "Protected outbound requests cannot redirect across origins"
                )
              }
            }
          : undefined,
      })
    } catch (error) {
      if (error instanceof ValidatedFetchError) {
        toOutboundHttpError(error)
      }
      throw error
    }
  },
})
