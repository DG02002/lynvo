export interface ParsedPluginDomainInput {
  password?: string
  url: string
  username?: string
}

export const parsePluginDomainInput = (
  value: string
): ParsedPluginDomainInput => {
  const trimmedValue = value.trim()
  const candidateUrl = trimmedValue.includes("://")
    ? trimmedValue
    : `https://${trimmedValue}`
  const parsedUrl = new URL(candidateUrl)
  const username = parsedUrl.username
    ? decodeURIComponent(parsedUrl.username)
    : undefined
  const password = parsedUrl.password
    ? decodeURIComponent(parsedUrl.password)
    : undefined
  parsedUrl.username = ""
  parsedUrl.password = ""

  return {
    url: parsedUrl.toString(),
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
  }
}

export const normalizePluginDomain = (value: string): string => {
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    throw new Error("Domain is required")
  }

  const candidateUrl = trimmedValue.includes("://")
    ? trimmedValue
    : `https://${trimmedValue}`
  const parsedUrl = new URL(candidateUrl)
  if (!parsedUrl.hostname || parsedUrl.username || parsedUrl.password) {
    throw new Error("Enter a valid domain")
  }

  return parsedUrl.hostname.toLowerCase().replace(/\.$/, "")
}
