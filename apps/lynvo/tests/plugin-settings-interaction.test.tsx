import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { LYNVO_PLUGIN_SERVER_ID } from "~shared/constants"

import {
  dismissPluginDomainSuggestion,
  shouldOfferPluginDomainSuggestion,
} from "~/features/links/saved-link-interaction"
import {
  usePluginSettingsInteraction,
  type PluginSettingsCommands,
} from "~/features/site/settings/plugin-settings-interaction"
import { client } from "~/lib/api/client"

describe("Plugin settings interaction", () => {
  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it("clears a Plugin Domain draft only after confirmed success", async () => {
    const submitted: unknown[] = []
    const commands: Partial<PluginSettingsCommands> = {
      createDomain: async (input) => {
        submitted.push(input)
        return { success: true }
      },
    }
    const { result } = renderHook(() =>
      usePluginSettingsInteraction({ commands, loadData: false })
    )

    act(() => {
      result.current.updateDomainDraft("protected", {
        domain: " protected.example ",
        username: "viewer",
        password: "secret",
        isCredentialEnabled: true,
      })
    })
    let didAdd = false
    await act(async () => {
      didAdd = await result.current.addDomain("protected")
    })

    expect(didAdd).toBe(true)
    expect(submitted).toEqual([
      {
        domain: "protected.example",
        pluginId: "protected",
        username: "viewer",
        password: "secret",
      },
    ])
    expect(result.current.domainDrafts.protected).toEqual({
      domain: "",
      username: "",
      password: "",
      isCredentialEnabled: false,
    })
    expect(result.current.domainOperations.protected).toEqual({
      status: "success",
    })
  })

  it("clears a dismissed Plugin Domain after adding it from settings", async () => {
    const suggestion = {
      domain: "protected.example",
      pluginServerId: LYNVO_PLUGIN_SERVER_ID,
      pluginId: "protected",
      pluginName: "Protected Source",
      sanitizedUrl: "https://protected.example/",
    }
    dismissPluginDomainSuggestion(suggestion)
    const { result } = renderHook(() =>
      usePluginSettingsInteraction({
        commands: { createDomain: async () => ({ success: true }) },
        loadData: false,
      })
    )

    act(() => {
      result.current.updateDomainDraft("protected", {
        domain: " Protected.Example ",
      })
    })
    await act(async () => {
      expect(await result.current.addDomain("protected")).toBe(true)
    })

    await expect(
      shouldOfferPluginDomainSuggestion(suggestion, async () => [])
    ).resolves.toEqual(suggestion)
  })

  it("clears a dismissed Plugin Domain after deleting it from settings", async () => {
    const domain = {
      id: "domain-1",
      pluginServerId: LYNVO_PLUGIN_SERVER_ID,
      pluginId: "protected",
      domain: "protected.example",
      hasCredential: false,
    }
    vi.spyOn(client.pluginDomains, "list").mockResolvedValue([domain])
    vi.spyOn(client.pluginServers, "list").mockResolvedValue([])
    const deleteDomain = vi
      .fn<PluginSettingsCommands["deleteDomain"]>()
      .mockResolvedValue({ success: true })
    const { result } = renderHook(() =>
      usePluginSettingsInteraction({
        commands: { deleteDomain },
      })
    )

    await waitFor(() => expect(result.current.domains).toEqual([domain]))
    dismissPluginDomainSuggestion(domain)
    await act(async () => {
      await result.current.handleDeleteDomain(domain.id)
    })

    await expect(
      shouldOfferPluginDomainSuggestion(domain, async () => [])
    ).resolves.toEqual(domain)
  })

  it("keeps a failed draft and supports retrying the same Plugin", async () => {
    let attempts = 0
    const commands: Partial<PluginSettingsCommands> = {
      createDomain: async () => ({ success: ++attempts > 1 }),
    }
    const { result } = renderHook(() =>
      usePluginSettingsInteraction({ commands, loadData: false })
    )

    void act(() =>
      result.current.updateDomainDraft("plugin", { domain: "example.com" })
    )
    await act(async () => {
      expect(await result.current.addDomain("plugin")).toBe(false)
    })
    expect(result.current.domainDrafts.plugin?.domain).toBe("example.com")

    await act(async () => {
      expect(await result.current.addDomain("plugin")).toBe(true)
    })
    expect(result.current.domainDrafts.plugin?.domain).toBe("")
  })

  it("deduplicates an in-flight operation on the same resource", async () => {
    let release: ((value: { success: boolean }) => void) | undefined
    let calls = 0
    const commands: Partial<PluginSettingsCommands> = {
      deleteDomain: async () => {
        calls += 1
        return await new Promise((resolve) => {
          release = resolve
        })
      },
    }
    const { result } = renderHook(() =>
      usePluginSettingsInteraction({ commands, loadData: false })
    )

    let first: Promise<void>
    await act(async () => {
      first = result.current.handleDeleteDomain("domain-1")
      await result.current.handleDeleteDomain("domain-1")
    })
    expect(calls).toBe(1)
    await act(async () => {
      release?.({ success: true })
      await first
    })
    expect(result.current.domainOperations["domain-1"]).toEqual({
      status: "success",
    })
  })

  it("routes credential and Custom Plugin Server workflows through one interface", async () => {
    const calls: string[] = []
    const success = async (name: string) => {
      calls.push(name)
      return { success: true }
    }
    const commands: Partial<PluginSettingsCommands> = {
      setCredential: async () => await success("save-credential"),
      deleteCredential: async () => await success("delete-credential"),
      createPluginServer: async () => await success("create-server"),
      togglePluginServer: async () => await success("toggle-server"),
      refreshPluginServer: async () => await success("refresh-server"),
      deletePluginServer: async () => await success("delete-server"),
      setPluginServerProxyKey: async () => await success("save-proxy-key"),
      togglePluginServerProxy: async () => await success("toggle-proxy"),
      refreshPluginServerProxyBalance: async () =>
        await success("refresh-proxy-balance"),
    }
    const { result } = renderHook(() =>
      usePluginSettingsInteraction({ commands, loadData: false })
    )

    await act(async () => {
      await result.current.handleSetDomainCredential("domain", "secret")
      await result.current.handleDeleteDomainCredential("domain")
      await result.current.handleAddPluginServer({
        baseUrl: "https://plugins.example",
        apiKey: "secret",
      })
      await result.current.handleTogglePluginServer("server", false)
      await result.current.handleRefreshPluginServer("server")
      await result.current.handleDeletePluginServer("server")
      await result.current.handleSetPluginServerProxyKey("server", "secret")
      await result.current.handleTogglePluginServerProxy("server", true)
      await result.current.handleRefreshPluginServerProxyBalance("server")
    })

    expect(calls).toEqual([
      "save-credential",
      "delete-credential",
      "create-server",
      "toggle-server",
      "refresh-server",
      "delete-server",
      "save-proxy-key",
      "toggle-proxy",
      "refresh-proxy-balance",
    ])
    expect(result.current.serverOperations["proxy-toggle:server"]).toEqual({
      status: "success",
    })
  })
})
