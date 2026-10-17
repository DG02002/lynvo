import { getLinkViewItemFlatMeta } from "~/features/links/link-metadata-accessors"
import type { LinkDebugLogEntry, LinkViewItem } from "~/features/links/types"

const GITHUB_ISSUES_URL = "https://github.com/DG02002/lynvo/issues/new"
const TELEGRAM_SHARE_URL = "https://t.me/share/url"

export interface IssueReport {
  readonly title: string
  readonly message: string
}

/** The entry a maintainer needs most: the newest failure, else the newest
 *  attempt so a report is still useful when nothing has failed yet. */
const findFeaturedDebugLogEntry = (
  item: LinkViewItem
): LinkDebugLogEntry | undefined => {
  const entries = item.metadata.debugLog
  if (!entries || entries.length === 0) {
    return undefined
  }
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]
    if (entry?.outcome === "failed") {
      return entry
    }
  }
  return undefined
}

const formatOccurredAt = (at: number): string =>
  new Date(at).toISOString().replace("T", " ").replace(/\..+/, " UTC")

const buildReportLines = (
  item: LinkViewItem,
  featured: LinkDebugLogEntry | undefined
): string[] => {
  const flatMeta = getLinkViewItemFlatMeta(item)
  const lines = [
    "Lynvo issue report",
    "",
    `Request ID: ${featured?.requestId ?? "(not recorded)"}`,
    `Error code: ${featured?.errorCode ?? "(not recorded)"}`,
  ]
  if (featured?.httpStatus !== undefined) {
    lines.push(`HTTP status: ${featured.httpStatus}`)
  }
  const pluginServerId = featured?.pluginServerId ?? flatMeta.pluginServerId
  if (pluginServerId) {
    lines.push(`Plugin Server: ${pluginServerId}`)
  }
  const pluginId = featured?.pluginId ?? flatMeta.pluginId
  if (pluginId) {
    lines.push(`Plugin: ${pluginId}`)
  }
  if (featured?.attempt !== undefined) {
    lines.push(`Attempt: ${featured.attempt}`)
  }
  if (featured) {
    lines.push(`Occurred: ${formatOccurredAt(featured.at)}`)
  }
  lines.push(`Source: ${item.url}`)
  if (featured?.detail) {
    lines.push("", featured.detail)
  }
  return lines
}

export const buildIssueReport = (item: LinkViewItem): IssueReport => {
  const featured = findFeaturedDebugLogEntry(item)
  const errorCode = featured?.errorCode
  return {
    title: errorCode ? `Extraction failed: ${errorCode}` : "Extraction failed",
    message: buildReportLines(item, featured).join("\n"),
  }
}

const GITHUB_BODY_PROMPT = [
  "",
  "",
  "## What happened?",
  "",
  "<!-- Describe what you did and what went wrong. -->",
].join("\n")

export const buildGitHubIssueUrl = (report: IssueReport): string =>
  `${GITHUB_ISSUES_URL}?title=${encodeURIComponent(report.title)}&body=${encodeURIComponent(report.message + GITHUB_BODY_PROMPT)}`

export const buildTelegramReportUrl = (report: IssueReport): string =>
  `${TELEGRAM_SHARE_URL}?text=${encodeURIComponent(report.message)}`
