import { PRIVATE_IPV4_PATTERNS } from "./constants"
import { ProtocolError } from "@dg02002/lynvo-plugin-server-protocol"

export const assertSafeUpstreamUrl = (value: string): URL => {
  const url = new URL(value)
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ProtocolError(
      "UNSUPPORTED_URL",
      "Only http and https URLs are supported."
    )
  }

  const hostname = url.hostname.toLowerCase()
  const ipv6Hostname = hostname.includes(":")
    ? hostname.replace(/^\[|\]$/g, "")
    : undefined
  const isPrivateIpv6 =
    ipv6Hostname !== undefined &&
    (ipv6Hostname === "::1" || /^(?:fc|fd|fe[89ab])/.test(ipv6Hostname))
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(hostname)) ||
    isPrivateIpv6
  ) {
    throw new ProtocolError(
      "UNSUPPORTED_URL",
      "Private and local network addresses are not supported."
    )
  }

  return url
}
