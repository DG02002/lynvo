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

  it("reveals the report details behind a toggle instead of a code block", () => {
    render(
      <ReportIssueDialog
        item={createReportItem()}
        open
        onOpenChange={vi.fn()}
      />
    )

    expect(screen.queryByText("Request ID")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Show details" }))

    expect(screen.getByText("Request ID")).toBeVisible()
    expect(screen.getByText("request-failed")).toBeVisible()
    expect(screen.getByText("Error code")).toBeVisible()
    expect(screen.getByText("SOURCE_TIMEOUT")).toBeVisible()
    expect(screen.queryByText(/Lynvo issue report/)).not.toBeInTheDocument()
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

  it("uses the Help Center marks and keeps Telegram's badge distinct", () => {
    render(
      <ReportIssueDialog
        item={createReportItem()}
        open
        onOpenChange={vi.fn()}
      />
    )
    const telegramButton = screen.getByRole("button", {
      name: /Report on Telegram/,
    })
    const githubButton = screen.getByRole("button", {
      name: /Report on GitHub/,
    })

    expect(telegramButton).toHaveClass("border-0", "bg-input/30")
    expect(githubButton).toHaveClass("border-0", "bg-input/30")
    expect(telegramButton.querySelector("svg")).toHaveAttribute(
      "viewBox",
      "0 0 256 256"
    )
    expect(githubButton.querySelector("svg")).toHaveAttribute(
      "viewBox",
      "0 0 1024 1024"
    )
    expect(githubButton.querySelector("svg")).toHaveClass("fill-current")
  })
})
