import * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CustomPluginServerTable } from "~/features/site/settings/custom-plugin-server-table"

const pluginServer = {
  _id: "plugin-server-one",
  baseUrl: "http://localhost:8788",
  manifest: JSON.stringify({
    protocolVersion: "1.0",
    pluginServerId: "dev.example.plugin-server",
    displayName: "Example Plugin Server",
    auth: { type: "bearer" },
    matchers: [{ hosts: ["example.com"] }],
    features: {},
    extensions: {
      lynvo: {
        plugins: [
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

describe("CustomPluginServerTable", () => {
  it("shows a down enabled Plugin Server as operationally unavailable", () => {
    render(
      <CustomPluginServerTable
        pluginServers={[pluginServer]}
        requestOrigin="http://localhost:5173"
        onDeletePluginServer={vi.fn()}
        onRefreshPluginServer={vi.fn()}
        onTogglePluginServer={vi.fn()}
      />
    )

    expect(screen.getByText("Down")).toBeInTheDocument()
    const availabilitySwitch = screen.getByRole("switch", {
      name: "Example Plugin Server is down",
    })
    expect(availabilitySwitch).toHaveAttribute("aria-disabled", "true")
    expect(availabilitySwitch).not.toBeChecked()
    expect(
      document.querySelector('[data-icon-fallback="plugin-server"]')
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
