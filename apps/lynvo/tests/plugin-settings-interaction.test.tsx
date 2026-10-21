import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { LYNVO_PLUGIN_SERVER_ID } from "~shared/constants"

import {
  dismissPluginDomainSuggestion,
  shouldOfferPluginDomainSuggestion,
} from "~/features/links/saved-link-interaction"
import type { PluginSettingsCommands } from "~/features/site/settings/plugin-settings-interaction"
import { usePluginDomainSettings } from "~/features/site/settings/use-plugin-domain-settings"
import { usePluginServerSettings } from "~/features/site/settings/use-plugin-server-settings"
import { useProxySettings } from "~/features/site/settings/use-proxy-settings"
import { client } from "~/lib/api/client"

describe("Plugin settings interactions", () => {
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
      usePluginDomainSettings({ commands, loadData: false })
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
      usePluginDomainSettings({
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
    const deleteDomain = vi
      .fn<PluginSettingsCommands["deleteDomain"]>()
      .mockResolvedValue({ success: true })
    const { result } = renderHook(() =>
      usePluginDomainSettings({ commands: { deleteDomain } })
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
      usePluginDomainSettings({ commands, loadData: false })
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
      usePluginDomainSettings({ commands, loadData: false })
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

  it("routes domain, server, and proxy workflows through focused hooks", async () => {
    const calls: string[] = []
    const success = async (name: string) => {
      calls.push(name)
      return { success: true }
    }
    const commands: Partial<PluginSettingsCommands> = {
      setCredential: async () => await success("save-credential"),
      createPluginServer: async () => await success("create-server"),
      togglePluginServer: async () => await success("toggle-server"),
      refreshPluginServer: async () => await success("refresh-server"),
      deletePluginServer: async () => await success("delete-server"),
      setProxyProviderKey: async () => await success("save-proxy-key"),
      togglePluginServerProxy: async () => await success("toggle-proxy"),
      refreshProxyProviderBalance: async () =>
        await success("refresh-proxy-balance"),
    }
    const { result } = renderHook(() => ({
      domain: usePluginDomainSettings({ commands, loadData: false }),
      server: usePluginServerSettings({ commands, loadData: false }),
      proxy: useProxySettings({ commands, loadData: false }),
    }))

    await act(async () => {
      await result.current.domain.handleSetDomainCredential("domain", "secret")
      await result.current.server.handleAddPluginServer({
        baseUrl: "https://plugins.example",
        apiKey: "secret",
      })
      await result.current.server.handleTogglePluginServer("server", false)
      await result.current.server.handleRefreshPluginServer("server")
      await result.current.server.handleDeletePluginServer("server")
      await result.current.proxy.setProxyProviderKey("secret")
      await result.current.proxy.handleTogglePluginServerProxy("server", true)
      await result.current.proxy.refreshProxyProviderBalance()
    })

    expect(calls).toEqual([
      "save-credential",
      "create-server",
      "toggle-server",
      "refresh-server",
      "delete-server",
      "save-proxy-key",
      "toggle-proxy",
      "refresh-proxy-balance",
    ])
    expect(
      result.current.proxy.serverOperations["proxy-toggle:server"]
    ).toEqual({ status: "success" })
  })
})
