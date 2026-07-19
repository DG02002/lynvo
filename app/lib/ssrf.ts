// Private IP ranges
// 10.0.0.0 - 10.255.255.255
// 172.16.0.0 - 172.31.255.255
// 192.168.0.0 - 192.168.255.255
// 127.0.0.0 - 127.255.255.255
// 169.254.0.0 - 169.254.255.255 (Link-local)
// ::1 (IPv6 loopback)
// fc00::/7 (IPv6 unique local)
// fe80::/10 (IPv6 link-local)

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^0\.0\.0\.0/,
  /^::1$/,
  /^[fF][cCdD]/, // fc00::/7
  /^[fF][eE][89aAbB]/, // fe80::/10
]

export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)

    // 1. Protocol check
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return false
    }

    // 2. Hostname check
    const hostname = parsed.hostname

    // Block localhost explicitly
    if (hostname === "localhost") {
      return false
    }

    // Check if hostname is an IP address and if it's private
    // Note: This doesn't resolve DNS, so it only blocks direct IP usage.
    // In a full Node.js env we would resolve DNS, but in Workers we can't easily do that synchronously or without extra APIs.
    // However, blocking direct private IP access is a good baseline.

    // Simple regex to check if it looks like an IPv4 address
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
      for (const range of PRIVATE_IP_RANGES) {
        if (range.test(hostname)) {
          return false
        }
      }
    }

    // IPv6 check (basic)
    if (hostname.startsWith("[") && hostname.endsWith("]")) {
      const ip = hostname.slice(1, -1)
      if (
        ip === "::1" ||
        ip.toLowerCase().startsWith("fe80") ||
        ip.toLowerCase().startsWith("fc")
      ) {
        return false
      }
    }

    return true
  } catch {
    return false
  }
}
