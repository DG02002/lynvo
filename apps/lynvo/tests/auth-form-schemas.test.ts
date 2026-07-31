import { describe, expect, it } from "vitest"
import { z } from "zod"
import {
  changePasswordSchema,
  signInSchema,
  signUpSchema,
} from "~/lib/auth-form-schemas"

const getFieldErrors = (result: z.ZodSafeParseError<unknown>) =>
  z.flattenError(result.error).fieldErrors

describe("authentication form schemas", () => {
  it("requires both sign-in credentials without applying sign-up policy", () => {
    const emptyResult = signInSchema.safeParse({
      username: "",
      password: "",
    })
    expect(emptyResult.success).toBe(false)
    if (emptyResult.success) {
      return
    }

    expect(getFieldErrors(emptyResult)).toEqual({
      username: ["Username is required."],
      password: ["Password is required."],
    })
    expect(
      signInSchema.safeParse({
        username: "admin",
        password: "existing-password",
      }).success
    ).toBe(true)
  })

  it("applies account creation policy and confirmation validation", () => {
    const result = signUpSchema.safeParse({
      username: "settings",
      password: "weak",
      confirmPassword: "different",
    })
    expect(result.success).toBe(false)
    if (result.success) {
      return
    }

    expect(getFieldErrors(result)).toEqual({
      username: ["This username is reserved."],
      password: ["Password must be at least 15 characters."],
      confirmPassword: ["Passwords do not match."],
    })
  })

  it("rejects unknown form fields explicitly", () => {
    expect(
      signInSchema.safeParse({
        username: "admintest",
        password: "existing-password",
        unexpected: true,
      }).success
    ).toBe(false)
  })

  it("validates password changes and matching confirmation", () => {
    const result = changePasswordSchema.safeParse({
      oldPassword: "",
      newPassword: "StrongPasswordLong",
      confirmPassword: "StrongPasswordLong",
    })
    expect(result.success).toBe(false)
    if (result.success) {
      return
    }

    expect(getFieldErrors(result)).toEqual({
      oldPassword: ["Old password is required."],
    })
  })
})
