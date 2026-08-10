import { QueryClient } from "@tanstack/react-query"
import { authPaths } from "~/lib/paths"
import { clearRevokedSessionState } from "~/root/session-revocation"
import { createMemoryStorage } from "./memory-storage"

describe("authoritative session revocation", () => {
  it("clears account state and navigates to the registered sign-in route", () => {
    const storage = createMemoryStorage()
    const queryClient = new QueryClient()
    queryClient.setQueryData(["links", "user-one"], ["private"])
    storage.setItem("lynvo:user-one:remote", "private")
    storage.setItem("lynvo:user-two:remote", "preserved")
    const assign = vi.fn()

    clearRevokedSessionState(queryClient, storage, { assign }, "user-one")

    expect(queryClient.getQueryCache().getAll()).toEqual([])
    expect(storage.getItem("lynvo:user-one:remote")).toBeNull()
    expect(storage.getItem("lynvo:user-two:remote")).toBe("preserved")
    expect(assign).toHaveBeenCalledWith(authPaths.signIn)
  })
})
