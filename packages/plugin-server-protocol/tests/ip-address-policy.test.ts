import { describe, expect, it } from "vitest"
import { isBlockedIpUrl, isLocalUrl } from "../src/index"

const ipv4Url = (address: string): URL => new URL(`https://${address}/`)
const ipv6Url = (address: string): URL => new URL(`https://[${address}]/`)

describe("outbound URL address policy", () => {
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
    expect(isBlockedIpUrl(ipv4Url(hostname))).toBe(true)
  })

  it.each([
    "::",
    "::1",
    "::ffff:10.0.0.1",
    "::ffff:127.0.0.1",
    "64:ff9b::7f00:1",
    "64:ff9b:1::7f00:1",
    "fc00::1",
    "fd12::1",
    "fe80::1",
    "fec0::1",
    "ff02::1",
    "2001:db8::1",
  ])("blocks non-public IPv6 literals: %s", (address) => {
    expect(isBlockedIpUrl(ipv6Url(address))).toBe(true)
  })

  it.each([
    "8.8.8.8",
    "100.63.255.255",
    "172.15.255.255",
    "2001:4860:4860::8888",
  ])("allows public IP literals: %s", (address) => {
    const url = address.includes(":") ? ipv6Url(address) : ipv4Url(address)
    expect(isBlockedIpUrl(url)).toBe(false)
  })

  it.each(["fc.example.com", "fd.example.com", "fe8.example.com"])(
    "ignores DNS names that resemble IPv6 prefixes: %s",
    (hostname) => {
      expect(isBlockedIpUrl(new URL(`https://${hostname}/`))).toBe(false)
    }
  )

  it.each(["https://localhost/", "https://media.localhost/"])(
    "recognizes local hostnames: %s",
    (value) => {
      expect(isLocalUrl(new URL(value))).toBe(true)
    }
  )

  it("does not classify a public URL as local", () => {
    expect(isLocalUrl(new URL("https://media.example/"))).toBe(false)
  })

  it("classifies URL-normalized IPv6 hosts without considering their port", () => {
    expect(isBlockedIpUrl(new URL("https://[::1]:443/"))).toBe(true)
  })
})
