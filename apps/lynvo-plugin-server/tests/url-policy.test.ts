import { describe, expect, it } from "vitest"
import { ProtocolError } from "@dg02002/lynvo-plugin-server-protocol"
import { assertSafeUpstreamUrl } from "../src/url-policy"

const expectUnsupportedUrl = (value: string): void => {
  let error: unknown
  try {
    assertSafeUpstreamUrl(value)
  } catch (cause) {
    error = cause
  }

  expect(error).toBeInstanceOf(ProtocolError)
  expect(error).toMatchObject({ code: "UNSUPPORTED_URL" })
}

describe("upstream URL policy", () => {
  it.each([
    "https://localhost/video.mp4",
    "https://media.localhost/video.mp4",
    "https://[::]/video.mp4",
    "https://[::1]/video.mp4",
    "https://[::ffff:10.0.0.1]/video.mp4",
    "https://[::ffff:127.0.0.1]/video.mp4",
    "https://[64:ff9b::7f00:1]/video.mp4",
    "https://[64:ff9b:1::7f00:1]/video.mp4",
    "https://[fc00::1]/video.mp4",
    "https://[fd12::1]/video.mp4",
    "https://[fe80::1]/video.mp4",
    "https://[fec0::1]/video.mp4",
    "https://[ff02::1]/video.mp4",
    "https://[2001:0::1]/video.mp4",
    "https://[2001:db8::1]/video.mp4",
    "https://[2002::1]/video.mp4",
  ])("blocks local and non-public destinations: %s", (value) => {
    expectUnsupportedUrl(value)
  })

  it.each(["not a URL", "https://[fe80::1%25eth0]/video.mp4"])(
    "maps invalid URLs to protocol errors: %s",
    (value) => {
      expectUnsupportedUrl(value)
    }
  )

  it("allows public IPv6 literals", () => {
    expect(
      assertSafeUpstreamUrl("https://[2001:4860:4860::8888]/video.mp4").hostname
    ).toBe("[2001:4860:4860::8888]")
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
