import {
  isBlockedIpUrl,
  isLocalUrl,
  ProtocolError,
} from "@dg02002/lynvo-plugin-server-protocol"

export const assertSafeUpstreamUrl = (value: string): URL => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new ProtocolError("UNSUPPORTED_URL", "The upstream URL is invalid.")
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ProtocolError(
      "UNSUPPORTED_URL",
      "Only http and https URLs are supported."
    )
  }

  if (isLocalUrl(url) || isBlockedIpUrl(url)) {
    throw new ProtocolError(
      "UNSUPPORTED_URL",
      "Private and local network addresses are not supported."
    )
  }

  return url
}

export const decodeUrlComponent = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    throw new ProtocolError(
      "UNSUPPORTED_URL",
      "The URL contains an invalid percent-encoded component."
    )
  }
}

export const encodeUrlPathSegment = (value: string): string =>
  encodeURIComponent(value)
