const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"])
const DEFAULT_APP_ORIGIN = "http://localhost:5173"

export const assertLocalHttpOrigin = (value, errorMessage) => {
  let origin
  try {
    origin = new URL(value)
  } catch (cause) {
    throw new Error(errorMessage, { cause })
  }

  if (
    origin.protocol !== "http:" ||
    !LOCAL_HOSTNAMES.has(origin.hostname) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error(errorMessage)
  }
  return origin
}

export const readSeedAppOrigin = (environment, errorMessage) =>
  assertLocalHttpOrigin(
    environment.LYNVO_SEED_ORIGIN ?? DEFAULT_APP_ORIGIN,
    errorMessage
  )
