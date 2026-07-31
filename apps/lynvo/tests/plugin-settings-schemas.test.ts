import { describe, expect, it } from "vitest"
import { z } from "zod"
import { customPluginServerSchema } from "~/features/site/settings/plugin-settings-schemas"

const getFieldErrors = (value: unknown) => {
  const result = customPluginServerSchema.safeParse(value)
  expect(result.success).toBe(false)
  if (result.success) {
    return {}
  }
  return z.flattenError(result.error).fieldErrors
}

describe("plugin settings schemas", () => {
  it("normalizes a valid Custom Plugin Server URL", () => {
    expect(
      customPluginServerSchema.parse({
        baseUrl: "  https://plugin-server.example.com  ",
        apiKey: "secret",
      })
    ).toEqual({
      baseUrl: "https://plugin-server.example.com",
      apiKey: "secret",
    })
  })

  it("allows HTTP only for localhost development plugin servers", () => {
    expect(
      customPluginServerSchema.safeParse({
        baseUrl: "http://localhost:8788",
        apiKey: "",
      }).success
    ).toBe(true)
    expect(
      getFieldErrors({
        baseUrl: "http://plugin-server.example.com",
        apiKey: "",
      })
    ).toEqual({
      baseUrl: ["Plugin server base URL must use HTTPS."],
    })
  })

  it("reports invalid form fields and rejects unexpected input", () => {
    expect(getFieldErrors({ baseUrl: "", apiKey: "" })).toEqual({
      baseUrl: ["Base URL is required."],
    })
    expect(
      customPluginServerSchema.safeParse({
        baseUrl: "https://plugin-server.example.com",
        apiKey: "",
        enabled: true,
      }).success
    ).toBe(false)
  })
})
