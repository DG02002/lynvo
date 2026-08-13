import { z } from "zod"

export interface HttpBasicCredential {
  password: string
  username: string
}

const httpBasicCredentialSchema = z.object({
  username: z.string(),
  password: z.string(),
})

export const serializeHttpBasicCredential = (
  username: string,
  password: string
): string => JSON.stringify({ username, password })

export const parseHttpBasicCredential = (
  value: string
): HttpBasicCredential => {
  const parsed = httpBasicCredentialSchema.safeParse(JSON.parse(value))
  if (!parsed.success) {
    throw new Error("Invalid HTTP Basic Auth credential")
  }
  return parsed.data
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
