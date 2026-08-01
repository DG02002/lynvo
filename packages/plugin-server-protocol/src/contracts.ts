import {
  extractSuccessSchema,
  pluginServerManifestSchema,
  usageResponseSchema,
} from "./schemas.js"
import { getLynvoManifestExtension } from "./matching.js"
import type {
  ContractIssue,
  ContractParseResult,
  ContractValidationResult,
  ExtractSuccessResponse,
  PluginServerManifest,
  UsageResponse,
} from "./models.js"

const issue = (path: string, message: string): ContractIssue => ({
  path,
  message,
})

const mapSchemaIssues = (
  schemaIssues: ReadonlyArray<{
    path: ReadonlyArray<PropertyKey>
    message: string
  }>,
  fallbackPath: string
): ContractIssue[] =>
  schemaIssues.map((schemaIssue) =>
    issue(
      schemaIssue.path.map((segment) => String(segment)).join(".") ||
        fallbackPath,
      schemaIssue.message
    )
  )

const validateParsedPluginServerManifestContract = (
  value: unknown,
  manifest: PluginServerManifest
): ContractValidationResult => {
  const didDeclareUsage =
    typeof value === "object" && value !== null && "usage" in value
  const issues: ContractIssue[] = []
  const pluginIds = new Set<string>()
  const extension = getLynvoManifestExtension(manifest)

  if (!didDeclareUsage) {
    issues.push(
      issue("usage", "Declare the mandatory authenticated /usage endpoint.")
    )
  }

  if (!manifest.pluginServerId.includes(".")) {
    issues.push(
      issue(
        "pluginServerId",
        "Use a stable namespaced id such as com.example.plugin-server to avoid collisions."
      )
    )
  }

  if (manifest.iconUrl && !manifest.iconUrl.endsWith(".webp")) {
    issues.push(
      issue("iconUrl", "Use a direct HTTPS WebP URL for Plugin Server icons.")
    )
  }
  if (manifest.hasIcon === true && !manifest.iconUrl) {
    issues.push(issue("iconUrl", "Provide iconUrl when hasIcon is true."))
  }
  if (manifest.hasIcon === false && manifest.iconUrl) {
    issues.push(
      issue("hasIcon", "Set hasIcon to true when iconUrl is present.")
    )
  }

  if (!extension.plugins || extension.plugins.length === 0) {
    issues.push(
      issue("extensions.lynvo.plugins", "Declare at least one Plugin.")
    )
  }

  extension.plugins?.forEach((source, index) => {
    const basePath = `extensions.lynvo.plugins.${index}`
    if (pluginIds.has(source.id)) {
      issues.push(issue(`${basePath}.id`, `Duplicate source id: ${source.id}`))
    }
    pluginIds.add(source.id)

    if (source.iconUrl && !source.iconUrl.endsWith(".webp")) {
      issues.push(issue(`${basePath}.iconUrl`, "Use a direct HTTPS WebP URL."))
    }
    if (source.hasIcon === true && !source.iconUrl) {
      issues.push(
        issue(`${basePath}.iconUrl`, "Provide iconUrl when hasIcon is true.")
      )
    }
    if (source.hasIcon === false && source.iconUrl) {
      issues.push(
        issue(
          `${basePath}.hasIcon`,
          "Set hasIcon to true when iconUrl is present."
        )
      )
    }
    if (!source.status) {
      issues.push(
        issue(
          `${basePath}.status`,
          "Declare active, maintenance, degraded, or down."
        )
      )
    }
    if (!source.version) {
      issues.push(issue(`${basePath}.version`, "Declare a Plugin version."))
    }
    if (
      source.hosts.length === 0 &&
      (!source.matchers || source.matchers.length === 0)
    ) {
      issues.push(
        issue(
          `${basePath}.matchers`,
          "Declare hosts or matchers for this source."
        )
      )
    }
  })

  return {
    ok: issues.length === 0,
    issues,
  }
}

export const parsePluginServerManifestContract = (
  value: unknown
): ContractParseResult<PluginServerManifest> => {
  const parsed = pluginServerManifestSchema.safeParse(value)
  if (!parsed.success) {
    return {
      ok: false,
      issues: mapSchemaIssues(parsed.error.issues, "manifest"),
    }
  }
  const validation = validateParsedPluginServerManifestContract(
    value,
    parsed.data
  )
  return validation.ok ? { ...validation, value: parsed.data } : validation
}

export const validatePluginServerManifestContract = (
  value: unknown
): ContractValidationResult => {
  const parsed = parsePluginServerManifestContract(value)
  return { ok: parsed.ok, issues: parsed.issues }
}

const validateParsedExtractSuccessContract = (
  result: ExtractSuccessResponse
): ContractValidationResult => {
  const issues: ContractIssue[] = []

  if (result.plugin.iconUrl && !result.plugin.iconUrl.endsWith(".webp")) {
    issues.push(
      issue(
        "plugin.iconUrl",
        "Use a direct HTTPS WebP URL for Plugin Server icons."
      )
    )
  }

  if (
    result.plugin.pluginIconUrl &&
    !result.plugin.pluginIconUrl.endsWith(".webp")
  ) {
    issues.push(
      issue(
        "plugin.pluginIconUrl",
        "Use a direct HTTPS WebP URL for Plugin icons."
      )
    )
  }

  return {
    ok: issues.length === 0,
    issues,
  }
}

export const parseExtractSuccessContract = (
  value: unknown
): ContractParseResult<ExtractSuccessResponse> => {
  const parsed = extractSuccessSchema.safeParse(value)
  if (!parsed.success) {
    return {
      ok: false,
      issues: mapSchemaIssues(parsed.error.issues, "extract"),
    }
  }
  const validation = validateParsedExtractSuccessContract(parsed.data)
  return validation.ok ? { ...validation, value: parsed.data } : validation
}

export const validateExtractSuccessContract = (
  value: unknown
): ContractValidationResult => {
  const parsed = parseExtractSuccessContract(value)
  return { ok: parsed.ok, issues: parsed.issues }
}

const validateParsedUsageContract = (
  usage: UsageResponse
): ContractValidationResult => {
  const metricIds = new Set<string>()
  const issues: ContractIssue[] = []
  usage.metrics.forEach((metric, index) => {
    if (metric.used > metric.limit) {
      issues.push(
        issue(`metrics.${index}.used`, "Usage cannot exceed its finite limit.")
      )
    }
    if (metricIds.has(metric.id)) {
      issues.push(
        issue(`metrics.${index}.id`, `Duplicate metric id: ${metric.id}`)
      )
    }
    metricIds.add(metric.id)
  })

  return { ok: issues.length === 0, issues }
}

export const parseUsageResponseContract = (
  value: unknown
): ContractParseResult<UsageResponse> => {
  const parsed = usageResponseSchema.safeParse(value)
  if (!parsed.success) {
    return {
      ok: false,
      issues: mapSchemaIssues(parsed.error.issues, "usage"),
    }
  }
  const validation = validateParsedUsageContract(parsed.data)
  return validation.ok ? { ...validation, value: parsed.data } : validation
}

export const validateUsageContract = (
  value: unknown
): ContractValidationResult => {
  const parsed = parseUsageResponseContract(value)
  return { ok: parsed.ok, issues: parsed.issues }
}
