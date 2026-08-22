import { readApiResponseError } from "~/lib/api-errors"
import { deviceCodeResponseSchema } from "~/lib/auth-gateway-schemas"
import { Result, Schema } from "effect"

export const createDeviceCode = async (deviceName: string) => {
  const response = await fetch("/api/auth/device/code", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceName }),
  })
  if (!response.ok) {
    throw await readApiResponseError(
      response,
      "Unable to create a device code."
    )
  }
  const result: unknown = await response.json()
  const parsed = Schema.decodeUnknownResult(deviceCodeResponseSchema)(result)
  if (Result.isFailure(parsed)) {
    throw new Error("Unable to create a device code.")
  }
  return parsed.success
}
