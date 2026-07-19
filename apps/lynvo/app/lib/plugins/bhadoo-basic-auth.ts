export interface BhadooAuthenticatedRequest {
  authorization?: string
  url: URL
}

const encodeBasicCredentials = (username: string, password: string) => {
  const credentialBytes = new TextEncoder().encode(`${username}:${password}`)
  let binaryCredentials = ""
  for (const credentialByte of credentialBytes) {
    binaryCredentials += String.fromCharCode(credentialByte)
  }
  return btoa(binaryCredentials)
}

export const createBasicAuthorization = (username: string, password: string) =>
  `Basic ${encodeBasicCredentials(username, password)}`

export const createBhadooAuthenticatedRequest = (
  sourceUrl: string | URL
): BhadooAuthenticatedRequest => {
  const url = new URL(sourceUrl)
  if (!url.username && !url.password) {
    return { url }
  }

  const username = decodeURIComponent(url.username)
  const password = decodeURIComponent(url.password)
  url.username = ""
  url.password = ""

  return {
    authorization: createBasicAuthorization(username, password),
    url,
  }
}
