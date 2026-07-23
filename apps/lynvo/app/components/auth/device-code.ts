export const createDeviceCode = async (deviceName: string) => {
  const response = await fetch("/api/auth/tv/code", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceName }),
  })
  if (!response.ok) {
    throw new Error("Unable to create a device code")
  }
  const result: unknown = await response.json()
  if (
    typeof result !== "object" ||
    result === null ||
    !("code" in result) ||
    !("pollSecret" in result) ||
    !("expiresAt" in result) ||
    !("deviceName" in result) ||
    typeof result.code !== "string" ||
    typeof result.pollSecret !== "string" ||
    typeof result.expiresAt !== "number" ||
    typeof result.deviceName !== "string"
  ) {
    throw new Error("Unable to create a device code")
  }
  return {
    code: result.code,
    pollSecret: result.pollSecret,
    expiresAt: result.expiresAt,
    deviceName: result.deviceName,
  }
}
