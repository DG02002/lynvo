import { Result, Schema } from "effect"
import { lynvoPluginCatalogSchema } from "./schemas.js"
import type {
  ExtractRequest,
  LynvoManifestExtension,
  PluginMetadata,
  PluginServerManifest,
  PluginServerMatcher,
} from "./models.js"

const patternToExpression = (
  pattern: string,
  segmentWildcard: string
): RegExp => {
  const expression = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "TEMP_DBL_STAR")
    .replace(/\*/g, segmentWildcard)
    .replace(/TEMP_DBL_STAR/g, ".*")
  return new RegExp(`^${expression}$`, "i")
}

export const matchPluginServerUrl = (
  targetUrl: string,
  matchers: readonly PluginServerMatcher[]
): boolean => {
  try {
    const parsed = new URL(targetUrl)
    const hostname = parsed.hostname.toLowerCase()
    const pathname = parsed.pathname
    const scheme = parsed.protocol.replace(":", "")

    for (const matcher of matchers) {
      const schemes = new Set(matcher.schemes ?? ["https"])
      if (!schemes.has(scheme)) {
        continue
      }

      const hosts = new Set(matcher.hosts.map((host) => host.toLowerCase()))
      let didHostMatch = hosts.has(hostname)

      if (!didHostMatch && matcher.hostPatterns) {
        didHostMatch = matcher.hostPatterns.some((pattern) =>
          patternToExpression(pattern, ".*").test(hostname)
        )
      }

      if (!didHostMatch) {
        continue
      }

      const pathPatterns = matcher.pathPatterns ?? ["/**"]
      const didPathMatch = pathPatterns.some((pattern) =>
        patternToExpression(pattern, "[^/]*").test(pathname)
      )

      if (didPathMatch) {
        return true
      }
    }
  } catch {
    return false
  }
  return false
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

export const parseLynvoManifestExtension = (
  manifest: PluginServerManifest
): LynvoManifestExtension => {
  const extension = readLynvoExtension(manifest)
  return extension === undefined
    ? { plugins: [] }
    : Schema.decodeUnknownSync(lynvoPluginCatalogSchema)(extension)
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
