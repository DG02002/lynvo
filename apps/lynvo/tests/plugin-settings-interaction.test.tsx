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
    const commands: PluginSettingsCommands = {
      createDomain: async (input) => {
        submitted.push(input)
        return { success: true }
      },
    }
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const { result } = renderHook(
      () => usePluginSettingsInteraction({ commands }),
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
})
