import * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ExternalWorkerTable } from "~/features/site/settings/external-worker-table"

const worker = {
  _id: "worker-one",
  baseUrl: "http://localhost:8788",
  manifest: JSON.stringify({
    protocolVersion: "1.0",
    extractorId: "com.lynvo.plnkextractor",
    displayName: "PlnkExtractor",
    auth: { type: "bearer" },
    matchers: [{ hosts: ["example.com"] }],
    features: {},
    extensions: {},
  }),
  enabled: true,
  verificationStatus: "down",
}

describe("ExternalWorkerTable", () => {
  it("shows a down enabled worker as operationally unavailable", () => {
    render(
      <ExternalWorkerTable
        workers={[worker]}
        onDeleteWorker={vi.fn()}
        onRefreshWorker={vi.fn()}
        onToggleWorker={vi.fn()}
      />
    )

    expect(screen.getByText("Down")).toBeInTheDocument()
    const availabilitySwitch = screen.getByRole("switch", {
      name: "PlnkExtractor is down",
    })
    expect(availabilitySwitch).toHaveAttribute("aria-disabled", "true")
    expect(availabilitySwitch).not.toBeChecked()
  })
})
