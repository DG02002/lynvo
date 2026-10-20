import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ProxySettings } from "~/features/site/settings/proxy-settings"

const makeServer = (
  id: string,
  displayName: string,
  proxyEnabled: boolean,
  verificationStatus = "verified"
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
  verificationStatus,
  proxyEnabled,
  lastVerifiedAt: 1,
  lastManifestRefreshAt: 1,
  createdAt: 1,
  updatedAt: 1,
})

interface ProxyState {
  readonly hasKey: boolean
  readonly balanceRemaining: number | null
  readonly balanceLimit: number | null
  readonly balanceCheckedAt: number | null
}

const createProxyStateFetch = (readState: () => ProxyState) => async () =>
  Response.json({
    provider: "scrape-do",
    ...readState(),
  })

describe("ProxySettings", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows the provider key with one usage block and a switch per server", async () => {
    const checkedAt = Date.now() - 60_000
    const servers = [
      makeServer("first", "First Server", false),
      makeServer("second", "Second Server", true),
    ]
    const proxyState: ProxyState = {
      hasKey: true,
      balanceRemaining: 973,
      balanceLimit: 1_000,
      balanceCheckedAt: checkedAt,
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(
          input instanceof Request ? input.url : String(input),
          "https://lynvo.test"
        )
        if (url.pathname === "/api/plugin-servers") {
          return Response.json(servers)
        }
        if (url.pathname === "/api/plugin-domains") {
          return Response.json([])
        }
        if (url.pathname === "/api/proxy") {
          return await createProxyStateFetch(() => proxyState)()
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
    expect(screen.getByRole("img", { name: "Scrape.do" })).toBeVisible()
    expect(screen.getByText("Key saved")).toBeVisible()
    expect(screen.getByText("Monthly credit usage")).toBeVisible()
    expect(screen.getByText("3% used")).toBeVisible()
    expect(screen.getByText("27 of 1,000 credits used")).toBeVisible()
    // One provider usage block, even with two proxy-capable servers.
    expect(screen.getAllByText("Monthly credit usage")).toHaveLength(1)
    expect(
      screen.getByRole("switch", { name: "Use proxy for First Server" })
    ).not.toBeChecked()
    expect(
      screen.getByRole("switch", { name: "Use proxy for Second Server" })
    ).toBeChecked()
    expect(
      screen.getByRole("button", { name: "Refresh Scrape.do credits" })
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Remove Scrape.do key" })
    ).toBeVisible()

    fireEvent.click(
      screen.getByRole("button", { name: "Change Scrape.do key" })
    )
    expect(
      screen.getByText(
        "Lynvo encrypts this key and sends it only to servers whose proxy switch is on during Extraction."
      )
    ).toBeVisible()
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }))
    expect(
      screen.getByRole("link", { name: "Learn about proxy keys" })
    ).toHaveAttribute("href", "/docs/proxy-keys")
  })

  it("renders the empty-state navigation as a link", async () => {
    const proxyState: ProxyState = {
      hasKey: false,
      balanceRemaining: null,
      balanceLimit: null,
      balanceCheckedAt: null,
    }
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
        if (url.pathname === "/api/proxy") {
          return await createProxyStateFetch(() => proxyState)()
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
    expect(screen.queryByText("No key saved")).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Add Scrape.do key" })
    ).toBeVisible()
  })

  it("shows the refreshed balance and checked time after a refresh", async () => {
    const initialCheckedAt = Date.now()
    const refreshedCheckedAt = initialCheckedAt + 60_000
    let proxyState: ProxyState = {
      hasKey: true,
      balanceRemaining: 973,
      balanceLimit: 1_000,
      balanceCheckedAt: initialCheckedAt,
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(
          input instanceof Request ? input.url : String(input),
          "https://lynvo.test"
        )
        if (url.pathname === "/api/plugin-servers") {
          return Response.json([makeServer("first", "First Server", true)])
        }
        if (url.pathname === "/api/plugin-domains") {
          return Response.json([])
        }
        if (url.pathname === "/api/proxy") {
          return await createProxyStateFetch(() => proxyState)()
        }
        if (url.pathname === "/api/proxy/balance/refresh") {
          expect(init?.method).toBe("POST")
          proxyState = {
            hasKey: true,
            balanceRemaining: 901,
            balanceLimit: 1_000,
            balanceCheckedAt: refreshedCheckedAt,
          }
          return Response.json({
            success: true,
            remaining: 901,
            limit: 1_000,
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
      screen.getByRole("button", { name: "Refresh Scrape.do credits" })
    )

    expect(await screen.findByText("99 of 1,000 credits used")).toBeVisible()
    expect(
      document.querySelector(
        `time[datetime="${new Date(refreshedCheckedAt).toISOString()}"]`
      )
    ).not.toBeNull()
  })

  it("saves the account key once for every server", async () => {
    let proxyState: ProxyState = {
      hasKey: false,
      balanceRemaining: null,
      balanceLimit: null,
      balanceCheckedAt: null,
    }
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
          return Response.json([
            makeServer("first", "First Server", false),
            makeServer("second", "Second Server", true),
          ])
        }
        if (url.pathname === "/api/plugin-domains") {
          return Response.json([])
        }
        if (url.pathname === "/api/proxy") {
          return await createProxyStateFetch(() => proxyState)()
        }
        if (url.pathname === "/api/proxy/key") {
          expect(init?.body).toBe('{"token":"replacement-token"}')
          proxyState = {
            hasKey: true,
            balanceRemaining: 900,
            balanceLimit: 1_000,
            balanceCheckedAt: Date.now(),
          }
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
    fireEvent.click(screen.getByRole("button", { name: "Add Scrape.do key" }))
    fireEvent.change(screen.getByLabelText("Scrape.do API token"), {
      target: { value: "replacement-token" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save key" }))

    await waitFor(() => {
      expect(
        calls.some(
          ({ path, method }) => path === "/api/proxy/key" && method === "POST"
        )
      ).toBe(true)
    })
    // The account key is saved exactly once; no per-server key endpoints exist.
    expect(calls.filter(({ path }) => path === "/api/proxy/key")).toHaveLength(
      1
    )
    expect(
      calls.some(
        ({ path }) =>
          path.includes("/api/plugin-servers/") && path.endsWith("/proxy/key")
      )
    ).toBe(false)
    expect(await screen.findByText("100 of 1,000 credits used")).toBeVisible()
  })
})
