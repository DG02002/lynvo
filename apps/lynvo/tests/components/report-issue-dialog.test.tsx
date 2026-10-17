import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ReportIssueDialog } from "~/components/links/report-issue-dialog"
import type { LinkViewItem } from "~/features/links/types"

const createReportItem = (): LinkViewItem => ({
  url: "https://media.example/report-item",
  timestamp: Date.now(),
  title: "Report item",
  id: "report-item",
  metadata: {
    schemaVersion: 3,
    source: {
      pluginName: "Example Source",
      pluginServerId: "ui-test-plugin-server",
    },
    extraction: { extractedLinks: [] },
    playback: { openedUrls: [] },
    debugLog: [
      {
        at: 1_700_000_000_000,
        outcome: "failed",
        requestId: "request-failed",
        errorCode: "SOURCE_TIMEOUT",
        httpStatus: 504,
      },
    ],
  },
})

describe("ReportIssueDialog", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("shows the report that will be sent", () => {
    render(
      <ReportIssueDialog
        item={createReportItem()}
        open
        onOpenChange={vi.fn()}
      />
    )

    const preview = screen.getByText(/Lynvo issue report/)
    expect(preview).toHaveTextContent("Request ID: request-failed")
    expect(preview).toHaveTextContent("Error code: SOURCE_TIMEOUT")
  })

  it("opens a prefilled GitHub issue report", () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null)
    render(
      <ReportIssueDialog
        item={createReportItem()}
        open
        onOpenChange={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /Report on GitHub/ }))

    expect(openSpy).toHaveBeenCalledTimes(1)
    const [[url, target, features]] = openSpy.mock.calls
    const githubUrl = new URL(url)
    expect(githubUrl.origin + githubUrl.pathname).toBe(
      "https://github.com/DG02002/lynvo/issues/new"
    )
    expect(githubUrl.searchParams.get("title")).toBe(
      "Extraction failed: SOURCE_TIMEOUT"
    )
    expect(githubUrl.searchParams.get("body")).toContain(
      "Request ID: request-failed"
    )
    expect(target).toBe("_blank")
    expect(features).toContain("noopener")
  })

  it("opens a prefilled Telegram report", () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null)
    render(
      <ReportIssueDialog
        item={createReportItem()}
        open
        onOpenChange={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /Report on Telegram/ }))

    expect(openSpy).toHaveBeenCalledTimes(1)
    const telegramUrl = new URL(openSpy.mock.calls[0][0])
    expect(telegramUrl.origin + telegramUrl.pathname).toBe(
      "https://t.me/share/url"
    )
    expect(telegramUrl.searchParams.get("text")).toContain(
      "Request ID: request-failed"
    )
  })
})
