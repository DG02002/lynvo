export const validateBearerCredential = (
  request: Request,
  expectedApiKey: string
): boolean => {
  if (!expectedApiKey) {
    return false
  }

  return request.headers.get("Authorization") === `Bearer ${expectedApiKey}`
}

export const createBasicAuthorization = (
  username: string,
  password: string
): string => {
  const credentialBytes = new TextEncoder().encode(`${username}:${password}`)
  let binaryCredentials = ""
  for (const credentialByte of credentialBytes) {
    binaryCredentials += String.fromCharCode(credentialByte)
  }
  return `Basic ${btoa(binaryCredentials)}`
}
