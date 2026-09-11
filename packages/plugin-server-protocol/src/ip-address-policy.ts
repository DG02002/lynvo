const isBlockedIpv4Hostname = (hostname: string): boolean => {
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

const isBlockedIpv6Hostname = (hostname: string): boolean => {
  if (!hostname.startsWith("[") || !hostname.endsWith("]")) {
    return false
  }

  const address = hostname.slice(1, -1).toLowerCase()
  const firstGroup = Number.parseInt(address.split(":")[0] || "0", 16)
  return (
    address === "::" ||
    address === "::1" ||
    address.startsWith("::ffff:") ||
    address.startsWith("64:ff9b::") ||
    address.startsWith("64:ff9b:1:") ||
    (firstGroup & 0xfe00) === 0xfc00 ||
    (firstGroup & 0xffc0) === 0xfe80 ||
    (firstGroup & 0xffc0) === 0xfec0 ||
    (firstGroup & 0xff00) === 0xff00 ||
    address.startsWith("2001:db8:")
  )
}

/**
 * Returns whether a URL's IP literal should not be used as a public outbound
 * destination.
 *
 * Taking a URL rather than a raw hostname makes the URL parser responsible for
 * normalizing IPv4 spellings and IPv6 hextets. DNS names are intentionally
 * ignored, including names that begin with an IPv6 range prefix.
 */
export const isBlockedIpUrl = (url: URL): boolean => {
  const hostname = url.hostname.toLowerCase()
  return isBlockedIpv4Hostname(hostname) || isBlockedIpv6Hostname(hostname)
}

/** Returns whether a URL resolves to localhost or a localhost subdomain. */
export const isLocalUrl = (url: URL): boolean => {
  const hostname = url.hostname.toLowerCase()
  return hostname === "localhost" || hostname.endsWith(".localhost")
}
