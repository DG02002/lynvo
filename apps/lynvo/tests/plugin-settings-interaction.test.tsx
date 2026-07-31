import type { PropsWithChildren } from "react"
import { act, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  usePluginSettingsInteraction,
  type PluginSettingsCommands,
} from "~/features/site/settings/plugin-settings-interaction"

const createWrapper = (queryClient: QueryClient) =>
  function QueryWrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }

describe("Plugin settings interaction", () => {
  it("clears a Plugin Domain draft only after confirmed success", async () => {
    const submitted: unknown[] = []
    const commands: Partial<PluginSettingsCommands> = {
      createDomain: async (input) => {
        submitted.push(input)
        return { success: true }
      },
    }
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const { result } = renderHook(
      () => usePluginSettingsInteraction({ commands, loadData: false }),
      { wrapper: createWrapper(queryClient) }
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

  it("keeps a failed draft and supports retrying the same Plugin", async () => {
    let attempts = 0
    const commands: Partial<PluginSettingsCommands> = {
      createDomain: async () => ({ success: ++attempts > 1 }),
    }
    const queryClient = new QueryClient()
    const { result } = renderHook(
      () => usePluginSettingsInteraction({ commands, loadData: false }),
      { wrapper: createWrapper(queryClient) }
    )

    act(() =>
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
    const queryClient = new QueryClient()
    const { result } = renderHook(
      () => usePluginSettingsInteraction({ commands, loadData: false }),
      { wrapper: createWrapper(queryClient) }
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
    }
    const queryClient = new QueryClient()
    const { result } = renderHook(
      () => usePluginSettingsInteraction({ commands, loadData: false }),
      { wrapper: createWrapper(queryClient) }
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
    })

    expect(calls).toEqual([
      "save-credential",
      "delete-credential",
      "create-server",
      "toggle-server",
      "refresh-server",
      "delete-server",
    ])
  })
})
