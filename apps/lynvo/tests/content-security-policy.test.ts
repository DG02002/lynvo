import { describe, expect, it } from "vitest"
import { createContentSecurityPolicy } from "~/lib/content-security-policy"

describe("createContentSecurityPolicy", () => {
  it("allows plugin icons served from another port on the current development host", () => {
    const policy = createContentSecurityPolicy(
      "http://192.168.1.3:5173/settings/plugins",
      true
    )

    expect(policy).toContain("img-src")
    expect(policy).toContain("http://192.168.1.3:*")
  })

  it("does not allow the request host over HTTP in production", () => {
    const policy = createContentSecurityPolicy(
      "https://app.lynvo.example/settings/plugins",
      false,
      "request-nonce"
    )

    expect(policy).not.toContain("http://app.lynvo.example:*")
    expect(policy).toContain("script-src 'self' 'nonce-request-nonce'")
    expect(policy.match(/script-src[^;]+/)?.[0]).not.toContain(
      "'unsafe-inline'"
    )
    expect(policy).not.toContain("'unsafe-eval'")
  })
})
