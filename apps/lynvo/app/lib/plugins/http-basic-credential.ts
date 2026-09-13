import { Schema } from "effect"

export interface HttpBasicCredential {
  password: string
  username: string
}

const httpBasicCredentialSchema = Schema.Struct({
  username: Schema.String,
  password: Schema.String,
})

export interface ExtractedUrlCredentials {
  readonly password?: string
  readonly url: URL
  readonly username?: string
}

export const extractUrlCredentials = (
  sourceUrl: string,
  options: { readonly defaultProtocol?: string } = {}
): ExtractedUrlCredentials => {
  const candidateUrl =
    options.defaultProtocol && !sourceUrl.includes("://")
      ? `${options.defaultProtocol}//${sourceUrl}`
      : sourceUrl
  const url = new URL(candidateUrl)
  const username = url.username ? decodeURIComponent(url.username) : undefined
  const password = url.password ? decodeURIComponent(url.password) : undefined
  url.username = ""
  url.password = ""
  return { url, username, password }
}

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
  const extracted = extractUrlCredentials(sourceUrl)
  if (!extracted.username && !extracted.password) {
    return { url: extracted.url.toString() }
  }
  const credential: HttpBasicCredential = {
    username: extracted.username ?? "",
    password: extracted.password ?? "",
  }
  return { url: extracted.url.toString(), basicAuth: credential }
}
