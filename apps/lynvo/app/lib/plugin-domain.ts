export interface ParsedPluginDomainInput {
  password?: string
  url: string
  username?: string
}

export interface PluginDomainCandidate {
  domain: string
  password?: string
  sanitizedUrl: string
  username?: string
}

export interface PluginDomainSuggestion extends PluginDomainCandidate {
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

  const result: ParsedPluginDomainInput = {
    url: parsedUrl.toString(),
  }
  if (username) {
    result.username = username
  }
  if (password) {
    result.password = password
  }
  return result
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

export const parsePluginDomainCandidate = (
  value: string
): PluginDomainCandidate | undefined => {
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
    const candidate: PluginDomainCandidate = {
      domain: parsed.hostname.toLowerCase().replace(/\.$/, ""),
      sanitizedUrl: parsed.toString(),
    }
    if (username) {
      candidate.username = username
    }
    if (password) {
      candidate.password = password
    }
    return candidate
  } catch {
    return undefined
  }
}
