import { PRIVATE_IPV4_PATTERNS } from "./constants"

export const assertSafeUpstreamUrl = (value: string): URL => {
  const url = new URL(value)
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("UNSUPPORTED_URL")
  }

  const hostname = url.hostname.toLowerCase()
  if (
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost") ||
    PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(hostname)) ||
    hostname.startsWith("fc") ||
    hostname.startsWith("fd") ||
    hostname.startsWith("fe8") ||
    hostname.startsWith("fe9") ||
    hostname.startsWith("fea") ||
    hostname.startsWith("feb")
  ) {
    throw new Error("UNSUPPORTED_URL")
  }

  return url
}
