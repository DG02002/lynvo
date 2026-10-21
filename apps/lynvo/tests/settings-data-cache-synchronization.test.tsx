import { act, render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { RealtimeProvider } from "~/context/realtime-context"
import type { openRealtimeSocket } from "~/context/realtime/socket"
import { getSettingsDataCacheKey } from "~/features/site/settings/settings-data-cache"
import {
  clearAsyncResourceCache,
  useAsyncResource,
} from "~/hooks/use-async-resource"
import { SettingsDataCacheSynchronization } from "~/root/settings-data-cache-synchronization"

const CachedResource = ({
  cacheKey,
  load,
}: {
  cacheKey: string
  load: () => Promise<string>
}) => {
  useAsyncResource(load, [], { cacheKey })
  return null
}

describe("settings cache realtime synchronization", () => {
  beforeEach(() => {
    clearAsyncResourceCache()
  })

  it("invalidates the current user's settings caches when data version advances", async () => {
    let receiveMessage: ((message: RealtimeMessage) => void) | undefined
    const openSocket: typeof openRealtimeSocket = ({
      receiveMessage: onMessage,
    }) => {
      receiveMessage = onMessage
      return { close: vi.fn() }
    }
    const firstUserLoad = vi.fn(async () => "user-one-current")
    const firstOtherUserLoad = vi.fn(async () => "user-two-current")
    const firstUnrelatedLoad = vi.fn(async () => "unrelated-current")
    const sameUserLoad = vi.fn(async () => "user-one-same-version")
    const sameOtherUserLoad = vi.fn(async () => "user-two-same-version")
    const sameUnrelatedLoad = vi.fn(async () => "unrelated-same-version")
    const secondUserLoad = vi.fn(async () => "user-one-updated")
    const secondOtherUserLoad = vi.fn(async () => "user-two-current")
    const secondUnrelatedLoad = vi.fn(async () => "unrelated-current")
    const userCacheKey = getSettingsDataCacheKey("usage", "user-one")
    const otherUserCacheKey = getSettingsDataCacheKey("usage", "user-two")
    const unrelatedCacheKey = "other:resource"

    const renderTree = (
      showResources: boolean,
      loads: {
        user: () => Promise<string>
        otherUser: () => Promise<string>
        unrelated: () => Promise<string>
      }
    ) => (
      <RealtimeProvider
        user={{ id: "user-one", sessionId: "session-one" }}
        openSocket={openSocket}
      >
        <SettingsDataCacheSynchronization userId="user-one" />
        {showResources ? (
          <>
            <CachedResource cacheKey={userCacheKey} load={loads.user} />
            <CachedResource
              cacheKey={otherUserCacheKey}
              load={loads.otherUser}
            />
            <CachedResource
              cacheKey={unrelatedCacheKey}
              load={loads.unrelated}
            />
          </>
        ) : null}
      </RealtimeProvider>
    )

    const view = render(
      renderTree(true, {
        user: firstUserLoad,
        otherUser: firstOtherUserLoad,
        unrelated: firstUnrelatedLoad,
      })
    )
    await waitFor(() => {
      expect(firstUserLoad).toHaveBeenCalledOnce()
      expect(firstOtherUserLoad).toHaveBeenCalledOnce()
      expect(firstUnrelatedLoad).toHaveBeenCalledOnce()
      expect(receiveMessage).toBeDefined()
    })

    act(() => {
      receiveMessage?.({
        type: "session_hello",
        userId: "user-one",
        sessionId: "session-one",
        dataVersion: 10,
      })
      receiveMessage?.({ type: "data-changed", payload: { version: 10 } })
    })
    view.rerender(
      renderTree(false, {
        user: sameUserLoad,
        otherUser: sameOtherUserLoad,
        unrelated: sameUnrelatedLoad,
      })
    )
    view.rerender(
      renderTree(true, {
        user: sameUserLoad,
        otherUser: sameOtherUserLoad,
        unrelated: sameUnrelatedLoad,
      })
    )

    expect(sameUserLoad).not.toHaveBeenCalled()
    expect(sameOtherUserLoad).not.toHaveBeenCalled()
    expect(sameUnrelatedLoad).not.toHaveBeenCalled()

    act(() => {
      receiveMessage?.({ type: "data-changed", payload: { version: 11 } })
    })
    view.rerender(
      renderTree(false, {
        user: secondUserLoad,
        otherUser: secondOtherUserLoad,
        unrelated: secondUnrelatedLoad,
      })
    )
    view.rerender(
      renderTree(true, {
        user: secondUserLoad,
        otherUser: secondOtherUserLoad,
        unrelated: secondUnrelatedLoad,
      })
    )

    await waitFor(() => expect(secondUserLoad).toHaveBeenCalledOnce())
    expect(secondOtherUserLoad).not.toHaveBeenCalled()
    expect(secondUnrelatedLoad).not.toHaveBeenCalled()
  })
})
