import { ProtocolError } from "@dg02002/lynvo-plugin-server-protocol"
import { describe, expect, it } from "vitest"
import { assertSafeUpstreamUrl } from "../src/url-policy"

describe("upstream URL policy", () => {
  it("blocks private IPv6 literals, including bracketed URL hostnames", () => {
    for (const value of [
      "https://[::1]/video.mp4",
      "https://[fc00::1]/video.mp4",
      "https://[fd12::1]/video.mp4",
      "https://[fe80::1]/video.mp4",
    ]) {
      expect(() => assertSafeUpstreamUrl(value)).toThrow(ProtocolError)
    }
  })

  it("allows public DNS names that begin with private IPv6 prefixes", () => {
    for (const hostname of [
      "fc.example.com",
      "fd.example.com",
      "fe8.example.com",
    ]) {
      expect(
        assertSafeUpstreamUrl(`https://${hostname}/video.mp4`).hostname
      ).toBe(hostname)
    }
  })
})
