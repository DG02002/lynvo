import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearAsyncResourceCache,
  useAsyncResource,
} from "~/hooks/use-async-resource"

describe("useAsyncResource cache", () => {
  beforeEach(() => {
    clearAsyncResourceCache()
  })

  it("reuses a fresh response without loading it again", async () => {
    const firstLoad = vi.fn().mockResolvedValue("first")
    const first = renderHook(() =>
      useAsyncResource(firstLoad, [], { cacheKey: "settings:usage:user-1" })
    )

    await waitFor(() => expect(first.result.current.data).toBe("first"))
    first.unmount()

    const secondLoad = vi.fn().mockResolvedValue("second")
    const second = renderHook(() =>
      useAsyncResource(secondLoad, [], { cacheKey: "settings:usage:user-1" })
    )

    expect(second.result.current.data).toBe("first")
    expect(second.result.current.isLoading).toBe(false)
    expect(secondLoad).not.toHaveBeenCalled()
  })

  it("keeps stale data visible while revalidating", async () => {
    const firstLoad = vi.fn().mockResolvedValue("first")
    const first = renderHook(() =>
      useAsyncResource(firstLoad, [], {
        cacheKey: "settings:storage:user-1",
        cacheTtlMs: 0,
      })
    )

    await waitFor(() => expect(first.result.current.data).toBe("first"))
    first.unmount()

    const secondLoad = vi.fn().mockResolvedValue("second")
    const second = renderHook(() =>
      useAsyncResource(secondLoad, [], {
        cacheKey: "settings:storage:user-1",
        cacheTtlMs: 0,
      })
    )

    expect(second.result.current.data).toBe("first")
    expect(second.result.current.isLoading).toBe(false)
    await waitFor(() => expect(second.result.current.data).toBe("second"))
    expect(secondLoad).toHaveBeenCalledOnce()
  })

  it("reloads when dependencies change despite a fresh cache entry", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second")
    const { result, rerender } = renderHook(
      ({ bucket }: { bucket: number }) =>
        useAsyncResource(load, [bucket], {
          cacheKey: "settings:usage:user-1",
        }),
      { initialProps: { bucket: 1 } }
    )

    await waitFor(() => expect(result.current.data).toBe("first"))
    rerender({ bucket: 2 })

    await waitFor(() => expect(result.current.data).toBe("second"))
    expect(load).toHaveBeenCalledTimes(2)
  })

  it("supports explicit reloads for refresh and retry actions", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second")
    const { result } = renderHook(() =>
      useAsyncResource(load, [], { cacheKey: "settings:security:user-1" })
    )

    await waitFor(() => expect(result.current.data).toBe("first"))
    await act(async () => {
      await result.current.reload()
    })

    expect(result.current.data).toBe("second")
    expect(load).toHaveBeenCalledTimes(2)
  })
})
