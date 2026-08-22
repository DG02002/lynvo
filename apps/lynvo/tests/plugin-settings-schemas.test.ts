import { describe, expect, it } from "vitest"
import { Result, Schema } from "effect"
import {
  customPluginServerSchema,
  customPluginServerStandardSchema,
} from "~/features/site/settings/plugin-settings-schemas"

const getFieldErrors = (value: unknown) => {
  const result = customPluginServerStandardSchema["~standard"].validate(value)
  if (result instanceof Promise) {
    throw new Error("Unexpected Promise result")
  }
  expect(result.issues).toBeDefined()
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of result.issues ?? []) {
    const path = issue.path?.join(".") ?? "root"
    const errors = fieldErrors[path] ?? []
    errors.push(issue.message)
    fieldErrors[path] = errors
  }
  return fieldErrors
}

describe("plugin settings schemas", () => {
  it("normalizes a valid Custom Plugin Server URL", () => {
    expect(
      Schema.decodeUnknownSync(customPluginServerSchema)({
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
      Result.isSuccess(
        Schema.decodeUnknownResult(customPluginServerSchema)({
          baseUrl: "http://localhost:8788",
          apiKey: "",
        })
      )
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
  })
})
