import { describe, expect, it } from "vitest"
import { isBlockedIpHostname } from "../src/index"

const ipv6Hostname = (address: string): string =>
  new URL(`https://[${address}]/`).hostname

describe("outbound IP hostname policy", () => {
  it.each([
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.0.0.2",
    "192.168.0.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
  ])("blocks non-public IPv4 literals: %s", (hostname) => {
    expect(isBlockedIpHostname(hostname)).toBe(true)
  })

  it.each([
    "::",
    "::1",
    "::ffff:10.0.0.1",
    "::ffff:127.0.0.1",
    "64:ff9b::7f00:1",
    "fc00::1",
    "fd12::1",
    "fe80::1",
    "ff02::1",
    "2001:db8::1",
  ])("blocks non-public IPv6 literals: %s", (address) => {
    expect(isBlockedIpHostname(ipv6Hostname(address))).toBe(true)
  })

  it.each([
    "8.8.8.8",
    "100.63.255.255",
    "172.15.255.255",
    "2001:4860:4860::8888",
  ])("allows public IP literals: %s", (address) => {
    const hostname = address.includes(":") ? ipv6Hostname(address) : address
    expect(isBlockedIpHostname(hostname)).toBe(false)
  })

  it.each(["fc.example.com", "fd.example.com", "fe8.example.com"])(
    "ignores DNS names that resemble IPv6 prefixes: %s",
    (hostname) => {
      expect(isBlockedIpHostname(hostname)).toBe(false)
    }
  )
})
