export interface ParsedPluginDomainInput {
  password?: string
  url: string
  username?: string
}

export interface SourceUrlCandidate {
  domain: string
  password?: string
  sanitizedUrl: string
  username?: string
}

export interface SourceDomainSuggestion extends SourceUrlCandidate {
  pluginIconUrl?: string
  pluginId: string
  pluginName: string
  pluginServerId: string
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

export const parseSourceUrlCandidate = (
  value: string
): SourceUrlCandidate | undefined => {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== "https:") {
      return undefined
    }
    const username = parsed.username
      ? decodeURIComponent(parsed.username)
      : undefined
    const password = parsed.password
      ? decodeURIComponent(parsed.password)
      : undefined
    parsed.username = ""
    parsed.password = ""
    return {
      domain: parsed.hostname.toLowerCase().replace(/\.$/, ""),
      sanitizedUrl: parsed.toString(),
      ...(username ? { username } : {}),
      ...(password ? { password } : {}),
    }
  } catch {
    return undefined
  }
}
