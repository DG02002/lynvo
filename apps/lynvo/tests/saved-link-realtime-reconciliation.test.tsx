import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import { Effect } from "effect"
import type { PropsWithChildren } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SAVED_LINK_ANTI_ENTROPY_INTERVAL_MS } from "~/features/links/constants"
import { useSavedLinkRealtimeSynchronization } from "~/features/links/use-links/realtime-synchronization"

const { revisionRequest } = vi.hoisted(() => ({
  revisionRequest: vi.fn(),
}))

vi.mock("~/lib/effect/api/client", () => ({
  client: {
    links: {
      revision: () => Effect.promise(revisionRequest),
    },
  },
}))

describe("Saved link browser reconciliation", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    revisionRequest.mockResolvedValue({ revision: 2 })
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    })
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
    })
  })

  it("checks the lightweight revision while the realtime socket is unavailable", async () => {
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { unmount } = renderHook(
      () => useSavedLinkRealtimeSynchronization("account-one", 1),
      { wrapper }
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SAVED_LINK_ANTI_ENTROPY_INTERVAL_MS)
    })

    expect(revisionRequest).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["links", "account-one"],
      refetchType: "active",
    })
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
  })
})
