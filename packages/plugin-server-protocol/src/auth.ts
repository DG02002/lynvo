const BEARER_CREDENTIAL_PATTERN = /^Bearer\s+(.+)$/i

export const validateBearerCredential = (
  request: Request,
  expectedApiKey: string | undefined
): boolean => {
  const authorization = request.headers.get("authorization")
  if (!authorization || !expectedApiKey) {
    return false
  }

  const match = BEARER_CREDENTIAL_PATTERN.exec(authorization)
  if (!match) {
    return false
  }

  const actualBytes = new TextEncoder().encode(match[1])
  const expectedBytes = new TextEncoder().encode(expectedApiKey)
  if (actualBytes.length !== expectedBytes.length) {
    return false
  }

  let difference = 0
  for (let index = 0; index < actualBytes.length; index += 1) {
    difference |= actualBytes[index] ^ expectedBytes[index]
  }
  return difference === 0
}
