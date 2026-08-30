import { describe, expect, it } from "vitest"
import { createContentSecurityPolicy } from "~/lib/content-security-policy"

describe("createContentSecurityPolicy", () => {
  it("allows plugin icons served from another port on the current development host", () => {
    const policy = createContentSecurityPolicy({
      requestUrl: "http://192.168.1.3:5173/settings/plugins",
      isDevelopment: true,
    })

    expect(policy).toContain("img-src")
    expect(policy).toContain("http://192.168.1.3:*")
  })

  it("does not allow the request host over HTTP in production", () => {
    const policy = createContentSecurityPolicy({
      requestUrl: "https://app.lynvo.example/settings/plugins",
      isDevelopment: false,
      nonce: "request-nonce",
      inlineScriptHashes: ["first-script-hash", "second-script-hash"],
    })

    expect(policy).not.toContain("http://app.lynvo.example:*")
    expect(policy).toContain("script-src 'self' 'nonce-request-nonce'")
    expect(policy).toContain("'sha256-first-script-hash'")
    expect(policy).toContain("'sha256-second-script-hash'")
    expect(policy.match(/script-src[^;]+/)?.[0]).not.toContain(
      "'unsafe-inline'"
    )
    expect(policy).not.toContain("'unsafe-eval'")
  })

  it("allows embedded fonts without allowing other embedded resources", () => {
    const policy = createContentSecurityPolicy({
      requestUrl: "https://app.lynvo.example/",
      isDevelopment: false,
    })

    expect(policy).toContain("font-src 'self' data:")
    expect(policy).not.toContain("default-src 'self' data:")
  })
})
