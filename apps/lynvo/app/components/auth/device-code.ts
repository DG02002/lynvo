import { Result, Schema } from "effect"

import { readApiResponseError } from "~/lib/api-errors"
import { requestSameOrigin } from "~/lib/api/client"
import { deviceCodeResponseSchema } from "~/lib/auth-gateway-schemas"

export const createDeviceCode = async (deviceName: string) => {
  const response = await requestSameOrigin("/api/auth/device/code", {
    includeSessionIdentityHeaders: false,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    payload: { deviceName },
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
