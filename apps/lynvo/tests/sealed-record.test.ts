import { describe, expect, it } from "vitest"
import { sealRecord, unsealRecord } from "~/lib/security/sealed-record"

const ENCODED_KEY = btoa("0123456789abcdef0123456789abcdef")

describe("sealed record", () => {
  it("round trips plaintext with matching authenticated context", async () => {
    const additionalData = new TextEncoder().encode("context-a")
    const record = await sealRecord({
      encodedKey: ENCODED_KEY,
      additionalData,
      plaintext: new TextEncoder().encode("secret"),
    })

    const plaintext = await unsealRecord({
      encodedKey: ENCODED_KEY,
      additionalData,
      record,
    })

    expect(new TextDecoder().decode(plaintext)).toBe("secret")
  })

  it("rejects a record replayed in another context", async () => {
    const record = await sealRecord({
      encodedKey: ENCODED_KEY,
      additionalData: new TextEncoder().encode("context-a"),
      plaintext: new TextEncoder().encode("secret"),
    })

    await expect(
      unsealRecord({
        encodedKey: ENCODED_KEY,
        additionalData: new TextEncoder().encode("context-b"),
        record,
      })
    ).rejects.toBeDefined()
  })

  it("rejects keys with the wrong byte length", async () => {
    await expect(
      sealRecord({
        encodedKey: btoa("short"),
        additionalData: new Uint8Array(),
        plaintext: new TextEncoder().encode("secret"),
      })
    ).rejects.toThrow("32 bytes")
  })
})
