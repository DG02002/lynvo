import { describe, expect, it } from "vitest"

import {
  buildGitHubIssueUrl,
  buildIssueReport,
  buildTelegramReportUrl,
} from "~/features/links/report-issue"
import type { LinkViewItem } from "~/features/links/types"

const createItem = (
  debugLog: LinkViewItem["metadata"]["debugLog"]
): LinkViewItem => ({
  kind: "saved",
  id: "report-item",
  url: "https://media.example/report-item",
  timestamp: Date.now(),
  title: "Report item",
  metadata: {
    schemaVersion: 3,
    source: {
      pluginName: "Example Source",
      pluginServerId: "ui-test-plugin-server",
    },
    extraction: { extractedLinks: [] },
    playback: { openedUrls: [] },
    debugLog,
  },
})

describe("buildIssueReport", () => {
  it("features the newest failed debug log entry", () => {
    const item = createItem([
      {
        at: 1_700_000_000_000,
        outcome: "complete",
        requestId: "request-complete",
      },
      {
        at: 1_700_000_001_000,
        outcome: "failed",
        requestId: "request-failed-1",
        errorCode: "SOURCE_TIMEOUT",
        httpStatus: 504,
        attempt: 1,
        detail: "The Source did not respond in time.",
      },
      {
        at: 1_700_000_002_000,
        outcome: "failed",
        requestId: "request-failed-2",
        errorCode: "PLUGIN_SERVER_TIMEOUT",
        httpStatus: 504,
        pluginServerId: "server-2",
        attempt: 2,
        detail: "The Plugin Server rejected the request.",
      },
    ])

    const report = buildIssueReport(item)

    expect(report.title).toBe("Extraction failed: PLUGIN_SERVER_TIMEOUT")
    expect(report.message).toContain("Request ID: request-failed-2")
    expect(report.message).toContain("Error code: PLUGIN_SERVER_TIMEOUT")
    expect(report.message).toContain("HTTP status: 504")
    expect(report.message).toContain("Plugin Server: server-2")
    expect(report.message).toContain("Attempt: 2")
    expect(report.message).toContain("The Plugin Server rejected the request.")
    expect(report.message).toContain(
      "Source: https://media.example/report-item"
    )
    expect(report.message).not.toContain("Reported from:")
    expect(report.message).not.toContain("request-failed-1")
  })

  it("reports not-recorded fields when nothing has failed", () => {
    const item = createItem([
      { at: 1_700_000_000_000, outcome: "complete", requestId: "request-1" },
    ])

    const report = buildIssueReport(item)

    expect(report.title).toBe("Extraction failed")
    expect(report.message).toContain("Request ID: (not recorded)")
    expect(report.message).not.toContain("Occurred:")
  })

  it("states when no request id was recorded", () => {
    const item = createItem([
      { at: 1_700_000_000_000, outcome: "failed", errorCode: "EMPTY_RESULT" },
    ])

    const report = buildIssueReport(item)

    expect(report.message).toContain("Request ID: (not recorded)")
    expect(report.message).toContain("Error code: EMPTY_RESULT")
  })

  it("uses the item Plugin Server when the entry recorded none", () => {
    const item = createItem([
      { at: 1_700_000_000_000, outcome: "failed", errorCode: "SOURCE_DOWN" },
    ])

    const report = buildIssueReport(item)

    expect(report.message).toContain("Plugin Server: ui-test-plugin-server")
  })

  it("features nothing when the debug log is empty", () => {
    const item = createItem(undefined)

    const report = buildIssueReport(item)
    expect(report.title).toBe("Extraction failed")
    expect(report.message).toContain("Request ID: (not recorded)")
    expect(report.message).not.toContain("Occurred:")
  })
})

describe("report target URLs", () => {
  const report = buildIssueReport(
    createItem([
      {
        at: 1_700_000_000_000,
        outcome: "failed",
        requestId: "request id &?",
        errorCode: "SOURCE_TIMEOUT",
      },
    ])
  )

  it("builds a prefilled GitHub issue URL", () => {
    const url = new URL(buildGitHubIssueUrl(report))

    expect(url.origin + url.pathname).toBe(
      "https://github.com/DG02002/lynvo/issues/new"
    )
    expect(url.searchParams.get("title")).toBe(
      "Extraction failed: SOURCE_TIMEOUT"
    )
    expect(url.searchParams.get("body")).toContain("Request ID: request id &?")
    expect(url.searchParams.get("body")).toContain("## What happened?")
  })

  it("builds a prefilled Telegram share URL", () => {
    const url = new URL(buildTelegramReportUrl(report))

    expect(url.origin + url.pathname).toBe("https://t.me/share/url")
    expect(url.searchParams.has("url")).toBe(false)
    expect(url.searchParams.get("text")).toContain("Request ID: request id &?")
  })
})
