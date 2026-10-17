import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ProxySettings } from "~/features/site/settings/proxy-settings"

describe("ProxySettings", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows a supported server's key status, balance, and usage", async () => {
    const checkedAt = Date.now() - 60_000
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(
          input instanceof Request ? input.url : String(input),
          "https://lynvo.test"
        )
        if (url.pathname === "/api/plugin-servers") {
          return Response.json([
            {
              id: "plugin-server-1",
              userId: "user-1",
              baseUrl: "https://plugins.example.com",
              manifest: JSON.stringify({
                protocolVersion: "1.0",
                pluginServerId: "dev.example.plugin-server",
                displayName: "Proxy Capable",
                auth: { type: "bearer" },
                usage: { endpoint: "/usage" },
                matchers: [{ hosts: ["example.com"] }],
                features: {},
                extensions: {
                  lynvo: {
                    proxyProvider: "scrape-do",
                    plugins: [
                      {
                        id: "source-alpha",
                        displayName: "Source Alpha",
                        status: "active",
                        version: "1.0.0",
                        proxyCreditUsage: "Uses 5 proxy credits for rendering.",
                        hosts: ["example.com"],
                      },
                    ],
                  },
                },
              }),
              enabled: true,
              priority: 0,
              verificationStatus: "verified",
              hasProxyKey: true,
              proxyBalanceRemaining: 973,
              proxyBalanceLimit: 1000,
              proxyBalanceCheckedAt: checkedAt,
              proxyEnabled: true,
              lastVerifiedAt: checkedAt,
              lastManifestRefreshAt: checkedAt,
              createdAt: checkedAt,
              updatedAt: checkedAt,
            },
          ])
        }
        if (url.pathname === "/api/plugin-domains") {
          return Response.json([])
        }
        return new Response(null, { status: 404 })
      })
    )

    render(
      <MemoryRouter>
        <ProxySettings requestOrigin="https://lynvo.test" />
      </MemoryRouter>
    )

    expect(await screen.findByText("Proxy Capable")).toBeVisible()
    expect(screen.getByRole("img", { name: "Scrape.do" })).toBeVisible()
    expect(screen.getByText("Monthly credit usage")).toBeVisible()
    expect(screen.getByText("3% used")).toBeVisible()
    expect(screen.getByText("27 of 1,000 credits used")).toBeVisible()
    expect(
      screen.getByRole("switch", { name: "Disable proxy for Proxy Capable" })
    ).toBeChecked()
    expect(
      screen.getByRole("button", { name: "Refresh credits" })
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Remove proxy key" })
    ).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Change proxy key" }))
    expect(
      screen.getByText(
        "Lynvo encrypts this key and sends it only to supported Custom Plugin Servers during Extraction."
      )
    ).toBeVisible()
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }))
    expect(
      screen.getByRole("link", { name: "Learn about proxy keys" })
    ).toHaveAttribute("href", "/docs/proxy-keys")
  })

  it("renders the empty-state navigation as a link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(
          input instanceof Request ? input.url : String(input),
          "https://lynvo.test"
        )
        if (url.pathname === "/api/plugin-servers") {
          return Response.json([])
        }
        if (url.pathname === "/api/plugin-domains") {
          return Response.json([])
        }
        return new Response(null, { status: 404 })
      })
    )

    render(
      <MemoryRouter>
        <ProxySettings requestOrigin="https://lynvo.test" />
      </MemoryRouter>
    )

    const openPlugins = await screen.findByText("Open Plugins")
    expect(openPlugins.closest("a")).not.toBeNull()
    expect(openPlugins.closest("a")).toHaveAttribute(
      "href",
      "/settings/plugins"
    )
  })

  it("shows the refreshed balance and checked time after a refresh", async () => {
    const initialCheckedAt = Date.now()
    const refreshedCheckedAt = initialCheckedAt + 60_000
    let serverListCalls = 0
    const manifest = JSON.stringify({
      protocolVersion: "1.0",
      pluginServerId: "dev.example.plugin-server",
      displayName: "Proxy Capable",
      auth: { type: "bearer" },
      usage: { endpoint: "/usage" },
      matchers: [{ hosts: ["example.com"] }],
      features: {},
      extensions: {
        lynvo: {
          proxyProvider: "scrape-do",
          plugins: [],
        },
      },
    })
    const server = {
      id: "plugin-server-1",
      userId: "user-1",
      baseUrl: "https://plugins.example.com",
      manifest,
      enabled: true,
      priority: 0,
      verificationStatus: "verified",
      hasProxyKey: true,
      proxyBalanceRemaining: 973,
      proxyBalanceLimit: 1000,
      proxyBalanceCheckedAt: initialCheckedAt,
      proxyEnabled: true,
      lastVerifiedAt: initialCheckedAt,
      lastManifestRefreshAt: initialCheckedAt,
      createdAt: initialCheckedAt,
      updatedAt: initialCheckedAt,
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(
          input instanceof Request ? input.url : String(input),
          "https://lynvo.test"
        )
        if (url.pathname === "/api/plugin-servers") {
          serverListCalls += 1
          return Response.json([
            serverListCalls === 1
              ? server
              : {
                  ...server,
                  proxyBalanceRemaining: 901,
                  proxyBalanceCheckedAt: refreshedCheckedAt,
                },
          ])
        }
        if (url.pathname === "/api/plugin-domains") {
          return Response.json([])
        }
        if (
          url.pathname ===
          "/api/plugin-servers/plugin-server-1/proxy/balance/refresh"
        ) {
          expect(init?.method).toBe("POST")
          return Response.json({
            success: true,
            remaining: 901,
            limit: 1000,
            checkedAt: refreshedCheckedAt,
            dataVersion: 2,
          })
        }
        return new Response(null, { status: 404 })
      })
    )

    render(
      <MemoryRouter>
        <ProxySettings requestOrigin="https://lynvo.test" />
      </MemoryRouter>
    )

    expect(await screen.findByText("27 of 1,000 credits used")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Refresh credits" }))

    expect(await screen.findByText("99 of 1,000 credits used")).toBeVisible()
    expect(
      document.querySelector(
        `time[datetime="${new Date(refreshedCheckedAt).toISOString()}"]`
      )
    ).not.toBeNull()
  })
})
