import * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ExternalWorkerTable } from "~/features/site/settings/external-worker-table"

const worker = {
  _id: "worker-one",
  baseUrl: "http://localhost:8788",
  manifest: JSON.stringify({
    protocolVersion: "1.0",
    pluginServerId: "com.example.extractor",
    displayName: "Example Extractor",
    auth: { type: "bearer" },
    matchers: [{ hosts: ["example.com"] }],
    features: {},
    extensions: {
      lynvo: {
        sources: [
          {
            id: "source-alpha",
            displayName: "Source Alpha",
            homepage: "https://source-alpha.example/project",
            hosts: ["source-alpha.example"],
          },
        ],
      },
    },
  }),
  enabled: true,
  verificationStatus: "down",
}

describe("ExternalWorkerTable", () => {
  it("shows a down enabled worker as operationally unavailable", () => {
    render(
      <ExternalWorkerTable
        workers={[worker]}
        requestOrigin="http://localhost:5173"
        onDeleteWorker={vi.fn()}
        onRefreshWorker={vi.fn()}
        onToggleWorker={vi.fn()}
      />
    )

    expect(screen.getByText("Down")).toBeInTheDocument()
    const availabilitySwitch = screen.getByRole("switch", {
      name: "Example Extractor is down",
    })
    expect(availabilitySwitch).toHaveAttribute("aria-disabled", "true")
    expect(availabilitySwitch).not.toBeChecked()
    expect(
      document.querySelector('[data-icon-fallback="extractor"]')
    ).not.toBeNull()
    expect(
      document.querySelector('[data-icon-fallback="source"]')
    ).not.toBeNull()
    expect(
      screen.getByRole("link", {
        name: "View upstream project for Source Alpha",
      })
    ).toHaveAttribute("href", "https://source-alpha.example/project")
    expect(screen.queryByText("source-alpha.example")).not.toBeInTheDocument()
  })
})
