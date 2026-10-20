import { fireEvent, render, screen } from "@testing-library/react"
import * as React from "react"
import { MemoryRouter } from "react-router"
import { describe, expect, it, vi } from "vitest"

import { CustomPluginServerTable } from "~/features/site/settings/custom-plugin-server-table"

const pluginServer = {
  id: "plugin-server-one",
  baseUrl: "http://localhost:8788",
  manifest: JSON.stringify({
    protocolVersion: "1.0",
    pluginServerId: "dev.example.plugin-server",
    displayName: "Example Plugin Server",
    auth: { type: "bearer" },
    usage: { endpoint: "/usage" },
    matchers: [{ hosts: ["example.com"] }],
    features: {},
    extensions: {
      lynvo: {
        plugins: [
          {
            id: "source-alpha",
            displayName: "Source Alpha",
            homepage: "https://source-alpha.example/project",
            status: "active",
            version: "1.0.0",
            usageMultiplier: 5,
            proxyCreditUsage: "Uses 5 proxy credits for rendering.",
            hosts: ["source-alpha.example"],
          },
        ],
      },
    },
  }),
  enabled: true,
  verificationStatus: "down",
  proxyEnabled: true,
}

describe("CustomPluginServerTable", () => {
  const renderTable = (servers = [pluginServer]) =>
    render(
      <MemoryRouter>
        <CustomPluginServerTable
          pluginServers={servers}
          requestOrigin="http://localhost:5173"
          onDeletePluginServer={vi.fn()}
          onRefreshPluginServer={vi.fn()}
          onTogglePluginServer={vi.fn()}
        />
      </MemoryRouter>
    )

  it("shows an unavailable enabled Plugin Server", () => {
    renderTable()

    expect(screen.getByText("Unavailable")).toBeInTheDocument()
    const availabilitySwitch = screen.getByRole("switch", {
      name: "Example Plugin Server is unavailable",
    })
    expect(availabilitySwitch).toHaveAttribute("aria-disabled", "true")
    expect(availabilitySwitch).not.toBeChecked()
    expect(
      document.querySelector("[data-plugin-server-avatar='plugin-server-one']")
    ).not.toBeNull()
    expect(
      document.querySelector('[data-icon-fallback="source"]')
    ).not.toBeNull()
    expect(screen.queryByText(/Version 1\.0\.0/)).not.toBeInTheDocument()
  })

  it("moves Plugin version, proxy usage, and project details into an info popover", () => {
    renderTable()

    expect(
      screen.queryByRole("link", {
        name: "https://source-alpha.example/project",
      })
    ).not.toBeInTheDocument()

    const infoButton = screen.getByRole("button", { name: "Source Alpha info" })
    // The warning color marks the icon itself, not the trigger button.
    expect(infoButton.querySelector("svg")?.getAttribute("class")).toContain(
      "text-warning-foreground"
    )

    fireEvent.click(infoButton)

    expect(screen.getByText("Version 1.0.0")).toBeInTheDocument()
    expect(
      screen.getByText("Proxy usage: Uses 5 proxy credits for rendering.")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Might use up to 5x usage per extraction")
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("link", {
        name: "https://source-alpha.example/project",
      })
    ).toHaveAttribute("href", "https://source-alpha.example/project")
    expect(screen.queryByText("View project")).not.toBeInTheDocument()
  })

  it("keeps proxy state out of the Plugins table rows", () => {
    const baseManifest = JSON.parse(pluginServer.manifest)
    const capableServer = {
      ...pluginServer,
      id: "proxy-capable",
      proxyEnabled: true,
      manifest: JSON.stringify({
        ...baseManifest,
        displayName: "Proxy Capable",
        extensions: {
          lynvo: {
            ...baseManifest.extensions.lynvo,
            proxyProvider: "scrape-do",
          },
        },
      }),
    }
    renderTable([capableServer, pluginServer])

    expect(screen.queryByText("Proxy key set")).not.toBeInTheDocument()
    expect(screen.queryByText("Proxy key not set")).not.toBeInTheDocument()
  })
})
