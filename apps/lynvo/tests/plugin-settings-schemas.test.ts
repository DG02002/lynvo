import { describe, expect, it } from "vitest"
import { z } from "zod"
import { externalWorkerSchema } from "~/features/site/settings/plugin-settings-schemas"

const getFieldErrors = (value: unknown) => {
  const result = externalWorkerSchema.safeParse(value)
  expect(result.success).toBe(false)
  if (result.success) {
    return {}
  }
  return z.flattenError(result.error).fieldErrors
}

describe("plugin settings schemas", () => {
  it("normalizes a valid external worker URL", () => {
    expect(
      externalWorkerSchema.parse({
        baseUrl: "  https://worker.example.com  ",
        apiKey: "secret",
      })
    ).toEqual({
      baseUrl: "https://worker.example.com",
      apiKey: "secret",
    })
  })

  it("allows HTTP only for localhost development workers", () => {
    expect(
      externalWorkerSchema.safeParse({
        baseUrl: "http://localhost:8788",
        apiKey: "",
      }).success
    ).toBe(true)
    expect(
      getFieldErrors({
        baseUrl: "http://worker.example.com",
        apiKey: "",
      })
    ).toEqual({
      baseUrl: ["Worker base URL must use HTTPS."],
    })
  })

  it("reports invalid form fields and rejects unexpected input", () => {
    expect(getFieldErrors({ baseUrl: "", apiKey: "" })).toEqual({
      baseUrl: ["Base URL is required."],
    })
    expect(
      externalWorkerSchema.safeParse({
        baseUrl: "https://worker.example.com",
        apiKey: "",
        enabled: true,
      }).success
    ).toBe(false)
  })
})
