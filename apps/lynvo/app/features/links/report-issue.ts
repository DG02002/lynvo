import { getLinkViewItemFlatMeta } from "~/features/links/link-metadata-accessors"
import type { LinkDebugLogEntry, LinkViewItem } from "~/features/links/types"

const GITHUB_ISSUES_URL = "https://github.com/DG02002/lynvo/issues/new"
const TELEGRAM_SHARE_URL = "https://t.me/share/url"

interface IssueReportDetail {
  readonly label: string
  readonly value: string
}

export interface IssueReport {
  readonly title: string
  readonly message: string
  readonly details: readonly IssueReportDetail[]
}

/** Report the newest failure, so a later successful attempt does not hide its diagnosis. */
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

const buildReportDetails = (
  item: LinkViewItem,
  featured: LinkDebugLogEntry | undefined
): IssueReportDetail[] => {
  const flatMeta = getLinkViewItemFlatMeta(item)
  const details: IssueReportDetail[] = [
    { label: "Request ID", value: featured?.requestId ?? "(not recorded)" },
    { label: "Error code", value: featured?.errorCode ?? "(not recorded)" },
  ]
  if (featured?.httpStatus !== undefined) {
    details.push({ label: "HTTP status", value: String(featured.httpStatus) })
  }
  const pluginServerId = featured?.pluginServerId ?? flatMeta.pluginServerId
  if (pluginServerId) {
    details.push({ label: "Plugin Server", value: pluginServerId })
  }
  const pluginId = featured?.pluginId ?? flatMeta.pluginId
  if (pluginId) {
    details.push({ label: "Plugin", value: pluginId })
  }
  if (featured?.attempt !== undefined) {
    details.push({ label: "Attempt", value: String(featured.attempt) })
  }
  if (featured) {
    details.push({
      label: "Occurred",
      value: formatOccurredAt(featured.at),
    })
  }
  details.push({ label: "Source", value: item.url })
  if (featured?.detail) {
    details.push({ label: "Detail", value: featured.detail })
  }
  return details
}

export const buildIssueReport = (item: LinkViewItem): IssueReport => {
  const featured = findFeaturedDebugLogEntry(item)
  const errorCode = featured?.errorCode
  const details = buildReportDetails(item, featured)
  return {
    title: errorCode ? `Extraction failed: ${errorCode}` : "Extraction failed",
    message: [
      "Lynvo issue report",
      "",
      ...details.map((detail) => `${detail.label}: ${detail.value}`),
    ].join("\n"),
    details,
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
