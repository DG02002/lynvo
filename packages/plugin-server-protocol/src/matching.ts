import { Result, Schema } from "effect"
import { lynvoPluginCatalogSchema } from "./schemas.js"
import type {
  ExtractRequest,
  LynvoManifestExtension,
  PluginMetadata,
  PluginServerManifest,
  PluginServerMatcher,
} from "./models.js"

const REGULAR_EXPRESSION_SPECIAL_CHARACTERS = new Set([
  "\\",
  "^",
  "$",
  "+",
  "?",
  ".",
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  "|",
])

const patternToExpression = (
  pattern: string,
  segmentWildcard: string
): RegExp => {
  let expression = ""
  for (let patternIndex = 0; patternIndex < pattern.length; patternIndex += 1) {
    const character = pattern[patternIndex]
    if (character === "*") {
      if (pattern[patternIndex + 1] === "*") {
        expression += ".*"
        patternIndex += 1
      } else {
        expression += segmentWildcard
      }
      continue
    }

    expression += REGULAR_EXPRESSION_SPECIAL_CHARACTERS.has(character)
      ? "\\" + character
      : character
  }
  return new RegExp(`^${expression}$`, "i")
}

const matchesPluginServerMatcher = (
  parsedUrl: URL,
  matcher: PluginServerMatcher
): boolean => {
  const { hostname, pathname, protocol } = parsedUrl
  const scheme = protocol.replace(":", "")
  const schemes = new Set(matcher.schemes ?? ["https"])
  if (!schemes.has(scheme)) {
    return false
  }

  const normalizedHostname = hostname.toLowerCase()
  const hosts = new Set(matcher.hosts.map((host) => host.toLowerCase()))
  const matchesHost =
    hosts.has(normalizedHostname) ||
    Boolean(
      matcher.hostPatterns?.some((pattern) =>
        patternToExpression(pattern, ".*").test(normalizedHostname)
      )
    )
  if (!matchesHost) {
    return false
  }

  const pathPatterns = matcher.pathPatterns ?? ["/**"]
  return pathPatterns.some((pattern) =>
    patternToExpression(pattern, "[^/]*").test(pathname)
  )
}

export const matchPluginServerUrl = (
  targetUrl: string,
  matchers: readonly PluginServerMatcher[]
): boolean => {
  try {
    const parsedUrl = new URL(targetUrl)
    return matchers.some((matcher) =>
      matchesPluginServerMatcher(parsedUrl, matcher)
    )
  } catch {
    return false
  }
}

export const getExtractTargetUrl = (request: ExtractRequest): string =>
  request.input.kind === "source"
    ? request.input.sourceUrl
    : request.input.nodeUrl

const extensionsContainerSchema = Schema.Struct({
  extensions: Schema.optional(
    Schema.Struct({
      lynvo: Schema.optional(Schema.Unknown),
    })
  ),
})

const readLynvoExtension = (manifest: PluginServerManifest) => {
  const result = Schema.decodeUnknownResult(extensionsContainerSchema)(manifest)
  return Result.isSuccess(result) ? result.success.extensions?.lynvo : undefined
}

export const getLynvoManifestExtension = (
  manifest: PluginServerManifest
): LynvoManifestExtension => {
  const extension = readLynvoExtension(manifest)
  const result = Schema.decodeUnknownResult(lynvoPluginCatalogSchema)(extension)
  return Result.isSuccess(result) ? result.success : { plugins: [] }
}

export const getMatchedPlugin = (
  manifest: PluginServerManifest,
  targetUrl: string
): PluginMetadata | undefined => {
  const extension = getLynvoManifestExtension(manifest)
  return extension.plugins?.find((source) => {
    if (source.matchers && matchPluginServerUrl(targetUrl, source.matchers)) {
      return true
    }

    let host: string
    try {
      host = new URL(targetUrl).hostname.toLowerCase()
    } catch {
      return false
    }

    return source.hosts.some((sourceHost) => sourceHost.toLowerCase() === host)
  })
}

export const canPluginServerAttemptUrl = (
  manifest: PluginServerManifest,
  targetUrl: string,
  pluginId?: string
): boolean => {
  if (matchPluginServerUrl(targetUrl, manifest.matchers)) {
    return true
  }
  const plugins = getLynvoManifestExtension(manifest).plugins ?? []
  return pluginId
    ? plugins.some((plugin) => plugin.id === pluginId)
    : plugins.some((plugin) => plugin.matchStrategy === "probe")
}
