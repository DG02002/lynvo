import { fireEvent, render, screen, waitFor } from "@testing-library/react"
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
    expect(screen.getByText("Use proxy")).toBeVisible()
    expect(screen.getByText("Key saved")).toBeVisible()
    expect(
      screen.getByRole("switch", { name: "Use proxy for Proxy Capable" })
    ).toBeChecked()
    expect(
      screen.getByRole("button", {
        name: "Refresh credits for Proxy Capable",
      })
    ).toBeVisible()
    expect(
      screen.getByRole("button", {
        name: "Remove Scrape.do key for Proxy Capable",
      })
    ).toBeVisible()

    fireEvent.click(
      screen.getByRole("button", {
        name: "Change Scrape.do key for Proxy Capable",
      })
    )
    expect(
      screen.getByText(
        "Lynvo encrypts this key and sends it only to this server during Extraction."
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
    fireEvent.click(
      screen.getByRole("button", {
        name: "Refresh credits for Proxy Capable",
      })
    )

    expect(await screen.findByText("99 of 1,000 credits used")).toBeVisible()
    expect(
      document.querySelector(
        `time[datetime="${new Date(refreshedCheckedAt).toISOString()}"]`
      )
    ).not.toBeNull()
  })

  it("keeps proxy keys and credit balances scoped to their server", async () => {
    const checkedAt = Date.now()
    const makeServer = (
      id: string,
      displayName: string,
      remaining: number,
      limit: number,
      proxyEnabled: boolean
    ) => ({
      id,
      userId: "user-1",
      baseUrl: `https://${id}.example.com`,
      manifest: JSON.stringify({
        protocolVersion: "1.0",
        pluginServerId: `dev.example.${id}`,
        displayName,
        auth: { type: "bearer" },
        usage: { endpoint: "/usage" },
        matchers: [{ hosts: [`${id}.example.com`] }],
        features: {},
        extensions: { lynvo: { proxyProvider: "scrape-do", plugins: [] } },
      }),
      enabled: true,
      priority: 0,
      verificationStatus: "verified",
      hasProxyKey: true,
      proxyBalanceRemaining: remaining,
      proxyBalanceLimit: limit,
      proxyBalanceCheckedAt: checkedAt,
      proxyEnabled,
      lastVerifiedAt: checkedAt,
      lastManifestRefreshAt: checkedAt,
      createdAt: checkedAt,
      updatedAt: checkedAt,
    })
    const servers = [
      makeServer("first", "First Server", 100, 1_000, false),
      makeServer("second", "Second Server", 1_400, 2_000, true),
    ]
    const calls: { path: string; method: string }[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        let inputUrl: string
        if (input instanceof Request) {
          inputUrl = input.url
        } else if (input instanceof URL) {
          inputUrl = input.href
        } else {
          inputUrl = input
        }
        const url = new URL(inputUrl, "https://lynvo.test")
        calls.push({
          path: url.pathname,
          method:
            init?.method ?? (input instanceof Request ? input.method : "GET"),
        })
        if (url.pathname === "/api/plugin-servers") {
          return Response.json(servers)
        }
        if (url.pathname === "/api/plugin-domains") {
          return Response.json([])
        }
        if (url.pathname === "/api/plugin-servers/first/proxy/key") {
          expect(init?.body).toBe('{"token":"replacement-token"}')
          return Response.json(
            { success: true, remaining: 900, limit: 1_000, dataVersion: 2 },
            { headers: { "X-Lynvo-Data-Version": "2" } }
          )
        }
        return new Response(null, { status: 404 })
      })
    )

    render(
      <MemoryRouter>
        <ProxySettings requestOrigin="https://lynvo.test" />
      </MemoryRouter>
    )

    expect(await screen.findByText("First Server")).toBeVisible()
    expect(screen.getByText("900 of 1,000 credits used")).toBeVisible()
    expect(screen.getByText("600 of 2,000 credits used")).toBeVisible()
    expect(
      screen.getByRole("switch", { name: "Use proxy for First Server" })
    ).not.toBeChecked()
    expect(
      screen.getByRole("switch", { name: "Use proxy for Second Server" })
    ).toBeChecked()

    fireEvent.click(
      screen.getByRole("button", {
        name: "Change Scrape.do key for First Server",
      })
    )
    fireEvent.change(screen.getByLabelText("Scrape.do API token"), {
      target: { value: "replacement-token" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save key" }))

    await waitFor(() => {
      expect(
        calls.some(
          ({ path, method }) =>
            path === "/api/plugin-servers/first/proxy/key" && method === "POST"
        )
      ).toBe(true)
    })
    expect(
      calls.some(({ path }) => path === "/api/plugin-servers/second/proxy/key")
    ).toBe(false)
  })
})
