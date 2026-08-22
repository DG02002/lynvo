import { Schema } from "effect"

export interface HttpBasicCredential {
  password: string
  username: string
}

const httpBasicCredentialSchema = Schema.Struct({
  username: Schema.String,
  password: Schema.String,
})

export const serializeHttpBasicCredential = (
  username: string,
  password: string
): string => JSON.stringify({ username, password })

export const parseHttpBasicCredential = (
  value: string
): HttpBasicCredential => {
  try {
    return Schema.decodeUnknownSync(httpBasicCredentialSchema)(
      JSON.parse(value)
    )
  } catch {
    throw new Error("Invalid HTTP Basic Auth credential")
  }
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
