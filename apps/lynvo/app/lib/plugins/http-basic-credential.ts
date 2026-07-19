export interface HttpBasicCredential {
  password: string
  username: string
}

export const serializeHttpBasicCredential = (
  username: string,
  password: string
): string => JSON.stringify({ username, password })

export const parseHttpBasicCredential = (
  value: string
): HttpBasicCredential => {
  const parsed: unknown = JSON.parse(value)
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("username" in parsed) ||
    !("password" in parsed) ||
    typeof parsed.username !== "string" ||
    typeof parsed.password !== "string"
  ) {
    throw new Error("Invalid HTTP Basic Auth credential")
  }
  return { username: parsed.username, password: parsed.password }
}

export const applyHttpBasicCredential = (
  sourceUrl: string,
  credential: HttpBasicCredential
) => {
  const url = new URL(sourceUrl)
  url.username = credential.username
  url.password = credential.password
  return url.toString()
}

export const extractHttpBasicCredential = (sourceUrl: string) => {
  const url = new URL(sourceUrl)
  if (!url.username && !url.password) {
    return { url: url.toString() }
  }
  const credential: HttpBasicCredential = {
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  }
  url.username = ""
  url.password = ""
  return { url: url.toString(), basicAuth: credential }
}
