export { validateBearerCredential } from "@dg02002/lynvo-plugin-server-protocol"

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
