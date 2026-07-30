import { readApiResponseError } from "~/lib/api-errors"
import { deviceCodeResponseSchema } from "~/lib/auth-gateway-schemas"

export const createDeviceCode = async (deviceName: string) => {
  const response = await fetch("/api/auth/tv/code", {
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
  const parsed = deviceCodeResponseSchema.safeParse(result)
  if (!parsed.success) {
    throw new Error("Unable to create a device code.")
  }
  return parsed.data
}
