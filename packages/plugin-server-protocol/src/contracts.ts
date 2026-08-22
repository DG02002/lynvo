import { Result, Schema, SchemaIssue } from "effect"
import {
  extractSuccessSchema,
  pluginServerManifestSchema,
  usageResponseSchema,
  verifyErrorSchema,
  verifySuccessSchema,
} from "./schemas.js"
import { getLynvoManifestExtension } from "./matching.js"
import type {
  ContractIssue,
  ContractParseResult,
  ContractValidationResult,
  ExtractSuccessResponse,
  PluginServerManifest,
  UsageResponse,
  VerifyErrorResponse,
  VerifySuccessResponse,
} from "./models.js"

const issue = (path: string, message: string): ContractIssue => ({
  path,
  message,
})

const isSupportedIconUrl = (url: string): boolean =>
  url.endsWith(".webp") || url.endsWith(".svg") || url.endsWith(".png")

const formatStandardIssues = SchemaIssue.makeFormatterStandardSchemaV1()

const mapSchemaIssues = (
  schemaIssue: SchemaIssue.Issue,
  fallbackPath: string
): ContractIssue[] => {
  const result = formatStandardIssues(schemaIssue)
  return result.issues.map((standardIssue) =>
    issue(
      standardIssue.path
        ? standardIssue.path.map((segment) => String(segment)).join(".") ||
            fallbackPath
        : fallbackPath,
      standardIssue.message
    )
  )
}

const validateParsedPluginServerManifestContract = (
  didDeclareUsage: boolean,
  manifest: PluginServerManifest
): ContractValidationResult => {
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

  if (manifest.iconUrl && !isSupportedIconUrl(manifest.iconUrl)) {
    issues.push(
      issue(
        "iconUrl",
        "Use a direct HTTPS WebP, PNG, or SVG URL for Plugin Server icons."
      )
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
  if (didDeclareUsage && !manifest.usage) {
    issues.push(issue("usage", "Declare metrics when usage is provided."))
  }

  if (!extension) {
    return { ok: issues.length === 0, issues }
  }

  extension.plugins?.forEach((source, index) => {
    const basePath = `extensions.lynvo.plugins.${index}`
    if (pluginIds.has(source.id)) {
      issues.push(issue(`${basePath}.id`, `Duplicate source id: ${source.id}`))
    }
    pluginIds.add(source.id)

    if (source.iconUrl && !isSupportedIconUrl(source.iconUrl)) {
      issues.push(
        issue(
          `${basePath}.iconUrl`,
          "Use a direct HTTPS WebP, PNG, or SVG URL."
        )
      )
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
    const hasStaticMatchers =
      source.hosts.length > 0 || Boolean(source.matchers?.length)
    if (source.matchStrategy === "probe" && hasStaticMatchers) {
      issues.push(
        issue(
          `${basePath}.matchers`,
          "Probe-matched Plugins cannot declare hosts or matchers."
        )
      )
    }
    if (source.matchStrategy !== "probe" && !hasStaticMatchers) {
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

const usageDeclarationSchema = Schema.Struct({
  usage: Schema.Unknown,
})

const checkUsageDeclared = <Value>(value: Value): boolean =>
  Result.isSuccess(Schema.decodeUnknownResult(usageDeclarationSchema)(value))

export const parsePluginServerManifestContract = <Value>(
  value: Value
): ContractParseResult<PluginServerManifest> => {
  const didDeclareUsage = checkUsageDeclared(value)
  const result = Schema.decodeUnknownResult(pluginServerManifestSchema)(value)
  if (Result.isFailure(result)) {
    return {
      ok: false,
      issues: mapSchemaIssues(result.failure.issue, "manifest"),
    }
  }
  const manifestData = result.success
  const validation = validateParsedPluginServerManifestContract(
    didDeclareUsage,
    manifestData
  )
  return validation.ok ? { ...validation, value: manifestData } : validation
}

export const validatePluginServerManifestContract = <Value>(
  value: Value
): ContractValidationResult => {
  const parsed = parsePluginServerManifestContract(value)
  return { ok: parsed.ok, issues: parsed.issues }
}

const validateParsedExtractSuccessContract = (
  result: ExtractSuccessResponse
): ContractValidationResult => {
  const issues: ContractIssue[] = []

  if (result.plugin.iconUrl && !isSupportedIconUrl(result.plugin.iconUrl)) {
    issues.push(
      issue(
        "plugin.iconUrl",
        "Use a direct HTTPS WebP, PNG, or SVG URL for Plugin Server icons."
      )
    )
  }

  if (
    result.plugin.pluginIconUrl &&
    !isSupportedIconUrl(result.plugin.pluginIconUrl)
  ) {
    issues.push(
      issue(
        "plugin.pluginIconUrl",
        "Use a direct HTTPS WebP, PNG, or SVG URL for Plugin icons."
      )
    )
  }

  return {
    ok: issues.length === 0,
    issues,
  }
}

export const parseExtractSuccessContract = <Value>(
  value: Value
): ContractParseResult<ExtractSuccessResponse> => {
  const result = Schema.decodeUnknownResult(extractSuccessSchema)(value)
  if (Result.isFailure(result)) {
    return {
      ok: false,
      issues: mapSchemaIssues(result.failure.issue, "extract"),
    }
  }
  const extractData = result.success
  const validation = validateParsedExtractSuccessContract(extractData)
  return validation.ok ? { ...validation, value: extractData } : validation
}

export const validateExtractSuccessContract = <Value>(
  value: Value
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

export const parseUsageResponseContract = <Value>(
  value: Value
): ContractParseResult<UsageResponse> => {
  const result = Schema.decodeUnknownResult(usageResponseSchema)(value)
  if (Result.isFailure(result)) {
    return {
      ok: false,
      issues: mapSchemaIssues(result.failure.issue, "usage"),
    }
  }
  const usageData = result.success
  const validation = validateParsedUsageContract(usageData)
  return validation.ok ? { ...validation, value: usageData } : validation
}

export const validateUsageContract = <Value>(
  value: Value
): ContractValidationResult => {
  const parsed = parseUsageResponseContract(value)
  return { ok: parsed.ok, issues: parsed.issues }
}

export const parseVerifySuccessContract = <Value>(
  value: Value
): ContractParseResult<VerifySuccessResponse> => {
  const result = Schema.decodeUnknownResult(verifySuccessSchema)(value)
  if (Result.isFailure(result)) {
    return {
      ok: false,
      issues: mapSchemaIssues(result.failure.issue, "verify"),
    }
  }
  return { ok: true, issues: [], value: result.success }
}

export const validateVerifySuccessContract = <Value>(
  value: Value
): ContractValidationResult => {
  const parsed = parseVerifySuccessContract(value)
  return { ok: parsed.ok, issues: parsed.issues }
}

export const parseVerifyErrorContract = <Value>(
  value: Value
): ContractParseResult<VerifyErrorResponse> => {
  const result = Schema.decodeUnknownResult(verifyErrorSchema)(value)
  if (Result.isFailure(result)) {
    return {
      ok: false,
      issues: mapSchemaIssues(result.failure.issue, "verifyError"),
    }
  }
  return { ok: true, issues: [], value: result.success }
}

export const validateVerifyErrorContract = <Value>(
  value: Value
): ContractValidationResult => {
  const parsed = parseVerifyErrorContract(value)
  return { ok: parsed.ok, issues: parsed.issues }
}

