import { describe, expect, it } from "vitest"
import { validateBearerCredential } from "../src/index"

const requestWithAuthorization = (authorization?: string) =>
  new Request("https://plugin.example/verify", {
    headers: authorization ? { Authorization: authorization } : undefined,
  })

describe("validateBearerCredential", () => {
  it("accepts the configured credential", () => {
    expect(
      validateBearerCredential(
        requestWithAuthorization("Bearer secret-key"),
        "secret-key"
      )
    ).toBe(true)
  })

  it("rejects missing, malformed, and wrong credentials", () => {
    expect(
      validateBearerCredential(requestWithAuthorization(), "secret-key")
    ).toBe(false)
    expect(
      validateBearerCredential(
        requestWithAuthorization("Basic secret-key"),
        "secret-key"
      )
    ).toBe(false)
    expect(
      validateBearerCredential(
        requestWithAuthorization("Bearer wrong-key"),
        "secret-key"
      )
    ).toBe(false)
  })

  it("accepts a case-insensitive Bearer scheme and repeated whitespace", () => {
    expect(
      validateBearerCredential(
        requestWithAuthorization("bEaReR\tsecret-key"),
        "secret-key"
      )
    ).toBe(true)
  })
})
