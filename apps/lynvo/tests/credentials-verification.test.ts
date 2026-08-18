import { describe, expect, it } from "vitest"
import { hashPasswordSecret } from "../convex/passwordCrypto"
import { verifyCredentialsAccount } from "../convex/credentialsVerification"

describe("credentials verification", () => {
  it("returns the same outcome for a wrong username and wrong password", async () => {
    const secret = await hashPasswordSecret("correct-password")

    await expect(
      verifyCredentialsAccount(undefined, "wrong-password")
    ).resolves.toEqual({ kind: "invalid-credentials" })
    await expect(
      verifyCredentialsAccount(
        { userId: "users:one", secret },
        "wrong-password"
      )
    ).resolves.toEqual({ kind: "invalid-credentials" })
  })
})
