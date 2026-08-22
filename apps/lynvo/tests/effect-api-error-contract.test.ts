import { Effect, Schema } from "effect"
import { describe, expect, it } from "vitest"
import {
  BackendApiError,
  BackendError,
  PluginServerRegistrationApiError,
  PluginServerRegistrationError,
} from "~/lib/effect/errors"

describe("public Effect API error contracts", () => {
  it("strips nested causes and internal details", async () => {
    const sentinel = "secret-shaped-sentinel"
    const convexEncoded = await Effect.runPromise(
      Schema.encodeUnknownEffect(BackendApiError)(
        new BackendError({
          message: "Backend request failed",
          cause: { token: sentinel },
        })
      )
    )
    const registrationEncoded = await Effect.runPromise(
      Schema.encodeUnknownEffect(PluginServerRegistrationApiError)(
        new PluginServerRegistrationError({
          message: "Plugin Server request failed",
          details: { apiKey: sentinel },
        })
      )
    )

    expect(convexEncoded).toEqual({
      _tag: "BackendError",
      message: "Backend request failed",
    })
    expect(registrationEncoded).toEqual({
      _tag: "PluginServerRegistrationError",
      message: "Plugin Server request failed",
    })
    expect(JSON.stringify([convexEncoded, registrationEncoded])).not.toContain(
      sentinel
    )
  })
})
