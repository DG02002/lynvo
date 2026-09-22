import { extractUrlCredentials } from "./plugins/http-basic-credential"

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

const normalizePluginDomainHostname = (hostname: string): string =>
  hostname.toLowerCase().replace(/\.$/, "")

export const parsePluginDomainInput = (
  value: string
): ParsedPluginDomainInput => {
  const trimmedValue = value.trim()
  const extracted = extractUrlCredentials(trimmedValue, {
    defaultProtocol: "https:",
  })

  const result: ParsedPluginDomainInput = {
    url: extracted.url.toString(),
  }
  if (extracted.username) {
    result.username = extracted.username
  }
  if (extracted.password) {
    result.password = extracted.password
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

  return normalizePluginDomainHostname(parsedUrl.hostname)
}

export const parsePluginDomainCandidate = (
  value: string
): PluginDomainCandidate | undefined => {
  try {
    const extracted = extractUrlCredentials(value)
    if (extracted.url.protocol !== "https:") {
      return undefined
    }
    const candidate: PluginDomainCandidate = {
      domain: normalizePluginDomainHostname(extracted.url.hostname),
      sanitizedUrl: extracted.url.toString(),
    }
    if (extracted.username) {
      candidate.username = extracted.username
    }
    if (extracted.password) {
      candidate.password = extracted.password
    }
    return candidate
  } catch {
    return undefined
  }
}
