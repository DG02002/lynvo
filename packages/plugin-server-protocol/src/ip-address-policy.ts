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
    (first === 192 && second === 88 && third === 99) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  )
}

interface Ipv6Prefix {
  readonly groups: readonly number[]
  readonly bits: number
}

const BLOCKED_IPV6_PREFIXES: readonly Ipv6Prefix[] = [
  { groups: [0, 0, 0, 0, 0, 0, 0, 0], bits: 128 },
  { groups: [0, 0, 0, 0, 0, 0, 0, 1], bits: 128 },
  { groups: [0, 0, 0, 0, 0, 0xffff], bits: 96 },
  { groups: [0x64, 0xff9b, 0, 0, 0, 0], bits: 96 },
  { groups: [0x64, 0xff9b, 1], bits: 48 },
  { groups: [0xfc00], bits: 7 },
  { groups: [0xfe80], bits: 10 },
  { groups: [0xfec0], bits: 10 },
  { groups: [0xff00], bits: 8 },
  { groups: [0x2001, 0], bits: 32 },
  { groups: [0x2001, 0xdb8], bits: 32 },
  { groups: [0x2002], bits: 16 },
]

const parseIpv6GroupsPart = (value: string): number[] | undefined => {
  if (!value) {
    return []
  }

  const groups = value.split(":")
  if (
    groups.some(
      (group) =>
        !/^[0-9a-f]{1,4}$/.test(group) || Number.parseInt(group, 16) > 0xffff
    )
  ) {
    return undefined
  }

  return groups.map((group) => Number.parseInt(group, 16))
}

const parseIpv6Groups = (address: string): readonly number[] | undefined => {
  const compressionIndex = address.indexOf("::")
  if (compressionIndex !== -1) {
    if (address.indexOf("::", compressionIndex + 2) !== -1) {
      return undefined
    }

    const leftGroups = parseIpv6GroupsPart(address.slice(0, compressionIndex))
    const rightGroups = parseIpv6GroupsPart(address.slice(compressionIndex + 2))
    if (!leftGroups || !rightGroups) {
      return undefined
    }

    const missingGroupCount = 8 - leftGroups.length - rightGroups.length
    if (missingGroupCount < 1) {
      return undefined
    }

    return [
      ...leftGroups,
      ...Array.from({ length: missingGroupCount }, () => 0),
      ...rightGroups,
    ]
  }

  const groups = parseIpv6GroupsPart(address)
  return groups?.length === 8 ? groups : undefined
}

const matchesIpv6Prefix = (
  groups: readonly number[],
  prefix: Ipv6Prefix
): boolean => {
  const fullGroupCount = Math.floor(prefix.bits / 16)
  for (let index = 0; index < fullGroupCount; index += 1) {
    if (groups[index] !== prefix.groups[index]) {
      return false
    }
  }

  const remainingBits = prefix.bits % 16
  if (remainingBits === 0) {
    return true
  }

  const mask = 0xffff & (0xffff << (16 - remainingBits))
  return (
    (groups[fullGroupCount] & mask) === (prefix.groups[fullGroupCount] & mask)
  )
}

const isBlockedIpv6Hostname = (hostname: string): boolean => {
  if (!hostname.startsWith("[") || !hostname.endsWith("]")) {
    return false
  }

  const address = hostname.slice(1, -1).toLowerCase()
  const groups = parseIpv6Groups(address)
  return (
    groups === undefined ||
    BLOCKED_IPV6_PREFIXES.some((prefix) => matchesIpv6Prefix(groups, prefix))
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

/** Returns whether a URL has a localhost or localhost-subdomain hostname. */
export const isLocalUrl = (url: URL): boolean => {
  const hostname = url.hostname.toLowerCase()
  return hostname === "localhost" || hostname.endsWith(".localhost")
}
