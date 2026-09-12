import { Effect, Schema } from "effect"
import { describe, expect, it } from "vitest"
import {
  BackendApiError,
  BackendError,
  PluginCredentialChangeSupersededApiError,
  PluginCredentialChangeSupersededError,
  PluginDomainNotFoundApiError,
  PluginDomainNotFoundError,
  PluginServerUnavailableApiError,
  PluginServerUnavailableError,
  PluginServerRegistrationApiError,
  PluginServerRegistrationError,
} from "~/lib/effect/errors"

describe("public Effect API error contracts", () => {
  it("strips nested causes and internal details", async () => {
    const sentinel = "secret-shaped-sentinel"
    const backendEncoded = await Effect.runPromise(
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

    expect(backendEncoded).toEqual({
      _tag: "BackendError",
      message: "Backend request failed",
    })
    expect(registrationEncoded).toEqual({
      _tag: "PluginServerRegistrationError",
      message: "Plugin Server request failed",
    })
    expect(JSON.stringify([backendEncoded, registrationEncoded])).not.toContain(
      sentinel
    )
  })

  it("keeps plugin-domain conflict kinds at the public boundary", async () => {
    const encoded = await Promise.all([
      Effect.runPromise(
        Schema.encodeUnknownEffect(PluginDomainNotFoundApiError)(
          new PluginDomainNotFoundError({ message: "Plugin domain not found" })
        )
      ),
      Effect.runPromise(
        Schema.encodeUnknownEffect(PluginServerUnavailableApiError)(
          new PluginServerUnavailableError({
            message: "Plugin server not found or no longer available",
          })
        )
      ),
      Effect.runPromise(
        Schema.encodeUnknownEffect(PluginCredentialChangeSupersededApiError)(
          new PluginCredentialChangeSupersededError({
            message: "Plugin credential change was superseded",
          })
        )
      ),
    ])

    expect(encoded).toEqual([
      { _tag: "PluginDomainNotFoundError", message: "Plugin domain not found" },
      {
        _tag: "PluginServerUnavailableError",
        message: "Plugin server not found or no longer available",
      },
      {
        _tag: "PluginCredentialChangeSupersededError",
        message: "Plugin credential change was superseded",
      },
    ])
  })
})
