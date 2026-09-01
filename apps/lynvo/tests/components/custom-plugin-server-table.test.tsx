import * as React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "~/components/ui/tooltip"
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
}

describe("CustomPluginServerTable", () => {
  const renderTable = (servers = [pluginServer]) =>
    render(
      <TooltipProvider delay={0}>
        <CustomPluginServerTable
          pluginServers={servers}
          requestOrigin="http://localhost:5173"
          onDeletePluginServer={vi.fn()}
          onRefreshPluginServer={vi.fn()}
          onSetProxyKey={vi.fn(async () => true)}
          onTogglePluginServer={vi.fn()}
        />
      </TooltipProvider>
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
      document.querySelector('[data-icon-fallback="plugin-server"]')
    ).not.toBeNull()
    expect(
      document.querySelector('[data-icon-fallback="source"]')
    ).not.toBeNull()
    expect(screen.queryByText(/Version 1\.0\.0/)).not.toBeInTheDocument()
  })

  it("moves Plugin version, proxy usage, and project details into an info tooltip", () => {
    renderTable()

    expect(
      screen.queryByRole("link", {
        name: "https://source-alpha.example/project",
      })
    ).not.toBeInTheDocument()

    const infoButton = screen.getByRole("button", { name: "Source Alpha info" })
    expect(infoButton.className).toContain("text-yellow")

    fireEvent.mouseEnter(infoButton)

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

  it("offers the proxy key dialog only when the server declares the capability", () => {
    const baseManifest = JSON.parse(pluginServer.manifest)
    const capableServer = {
      ...pluginServer,
      id: "proxy-capable",
      hasProxyKey: true,
      proxyBalanceRemaining: 973,
      proxyBalanceLimit: 1000,
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

    expect(
      screen.getAllByText("Own proxy key · 973 credits left")
    ).toHaveLength(1)

    fireEvent.click(
      screen.getByRole("button", { name: "Actions for Example Plugin Server" })
    )
    expect(screen.queryByText("Proxy key")).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", { name: "Actions for Proxy Capable" })
    )
    fireEvent.click(screen.getByText("Proxy key"))

    expect(screen.getByText("Proxy key for Proxy Capable")).toBeInTheDocument()
    expect(screen.getByLabelText("Scrape.do API token")).toBeInTheDocument()
    expect(screen.getByText("Remove saved key")).toBeInTheDocument()
  })
})
