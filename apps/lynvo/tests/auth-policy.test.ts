import { describe, expect, it } from "vitest"
import {
  normalizeUsername,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  validatePassword,
  validateUsername,
} from "~/lib/auth-policy"
import {
  normalizeUsername as normalizeUsernameFromConvex,
  validatePassword as validatePasswordFromConvex,
  validateUsername as validateUsernameFromConvex,
} from "../convex/authPolicy"

describe("shared authentication policy", () => {
  it("normalizes usernames consistently", () => {
    expect(normalizeUsername("  Darshan_One  ")).toBe("darshan_one")
  })

  it("uses the same implementation in browser and Convex callers", () => {
    expect(normalizeUsernameFromConvex).toBe(normalizeUsername)
    expect(validateUsernameFromConvex).toBe(validateUsername)
    expect(validatePasswordFromConvex).toBe(validatePassword)
  })

  it.each([
    [
      "a".repeat(USERNAME_MIN_LENGTH - 1),
      `Username must be at least ${USERNAME_MIN_LENGTH} characters.`,
    ],
    ["a".repeat(USERNAME_MIN_LENGTH), null],
    ["a".repeat(USERNAME_MAX_LENGTH), null],
    [
      "a".repeat(USERNAME_MAX_LENGTH + 1),
      `Username must be at most ${USERNAME_MAX_LENGTH} characters.`,
    ],
    ["valid_name-1", null],
    [
      "invalid.name",
      "Username can only use letters, numbers, underscore, and hyphen.",
    ],
    ["Settings", "This username is reserved."],
    ["SUPPORT", "This username is reserved."],
  ])("validates username %s", (username, expectedError) => {
    expect(validateUsername(username)).toBe(expectedError)
  })

  it.each([
    [
      "A" + "a".repeat(PASSWORD_MIN_LENGTH - 2),
      "",
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    ],
    [
      "A" + "a".repeat(PASSWORD_MAX_LENGTH),
      "",
      `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`,
    ],
    ["lowercaseonly", "", "Password must include an uppercase letter."],
    ["UPPERCASEONLY", "", "Password must include a lowercase letter."],
    [
      "DarshanSecurePass",
      " Darshan ",
      "Password cannot contain your username.",
    ],
    ["AaaaaaaSecure", "", "Password is too repetitive."],
    ["Password123!", "", "Password is too common."],
    ["StrongPassword", "", null],
    ["StrongPass!!!", "darshan", null],
  ])(
    "validates password policy for %#",
    (password, username, expectedError) => {
      expect(validatePassword(password, username)).toBe(expectedError)
    }
  )
})
