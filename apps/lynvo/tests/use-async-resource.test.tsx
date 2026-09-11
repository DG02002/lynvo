import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearAsyncResourceCache,
  useAsyncResource,
} from "~/hooks/use-async-resource"
import { silenceConsoleErrorLogs } from "./support/silence-console-error-logs"

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
    expect(second.result.current.error).toBeUndefined()
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
    let resolveReload!: (value: string) => void
    const reloadPromise = new Promise<string>((resolve) => {
      resolveReload = resolve
    })
    const load = vi
      .fn()
      .mockResolvedValueOnce("first")
      .mockReturnValueOnce(reloadPromise)
    const { result } = renderHook(() =>
      useAsyncResource(load, [], { cacheKey: "settings:security:user-1" })
    )

    await waitFor(() => expect(result.current.data).toBe("first"))
    expect(result.current.error).toBeUndefined()
    expect(result.current.isLoading).toBe(false)
    let reloadRequest: Promise<void> | undefined
    act(() => {
      reloadRequest = result.current.reload()
    })
    expect(result.current.isLoading).toBe(true)
    resolveReload("second")
    await act(async () => {
      await reloadRequest
    })

    expect(result.current.data).toBe("second")
    expect(load).toHaveBeenCalledTimes(2)
  })
})

describe("useAsyncResource error handling", () => {
  beforeEach(() => {
    clearAsyncResourceCache()
    silenceConsoleErrorLogs()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("reports a defined error when a load rejects without a value", async () => {
    const load = vi.fn().mockRejectedValue(undefined)
    const { result } = renderHook(() =>
      useAsyncResource<string>(load, [], { cacheKey: "settings:usage:user-1" })
    )

    await waitFor(() => expect(result.current.error).toBeDefined())
    expect(result.current.data).toBeUndefined()
    expect(result.current.isLoading).toBe(false)
  })

  it("reports a failed load through the error state", async () => {
    const failure = new Error("load failed")
    const load = vi.fn().mockRejectedValue(failure)
    const { result } = renderHook(() =>
      useAsyncResource<string>(load, [], { cacheKey: "settings:usage:user-1" })
    )

    await waitFor(() => expect(result.current.error).toBe(failure))
    expect(result.current.data).toBeUndefined()
    expect(result.current.isLoading).toBe(false)
    expect(load).toHaveBeenCalledOnce()
  })

  it("delivers data and clears the error when a retry succeeds", async () => {
    const failure = new Error("load failed")
    const load = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValue("recovered")
    const { result } = renderHook(() =>
      useAsyncResource<string>(load, [], { cacheKey: "settings:usage:user-1" })
    )
    await waitFor(() => expect(result.current.error).toBe(failure))

    await act(async () => {
      await result.current.retry()
    })

    expect(result.current.data).toBe("recovered")
    expect(result.current.error).toBeUndefined()
    expect(result.current.isLoading).toBe(false)
  })

  it("keeps reload rejecting so awaiting callers can catch failures", async () => {
    const failure = new Error("load failed")
    const load = vi.fn().mockRejectedValue(failure)
    const { result } = renderHook(() =>
      useAsyncResource<string>(load, [], { cacheKey: "settings:usage:user-1" })
    )
    await waitFor(() => expect(result.current.error).toBe(failure))

    await act(async () => {
      await expect(result.current.reload()).rejects.toThrow(failure)
    })
  })

  it("keeps cached data and surfaces the error when a refresh fails", async () => {
    const failure = new Error("refresh failed")
    const firstLoad = vi.fn().mockResolvedValue("cached")
    const first = renderHook(() =>
      useAsyncResource<string>(firstLoad, [], {
        cacheKey: "settings:storage:user-1",
        cacheTtlMs: 0,
      })
    )
    await waitFor(() => expect(first.result.current.data).toBe("cached"))
    first.unmount()

    const secondLoad = vi.fn().mockRejectedValue(failure)
    const second = renderHook(() =>
      useAsyncResource<string>(secondLoad, [], {
        cacheKey: "settings:storage:user-1",
        cacheTtlMs: 0,
      })
    )

    expect(second.result.current.data).toBe("cached")
    expect(second.result.current.isLoading).toBe(false)
    await waitFor(() => expect(second.result.current.error).toBe(failure))
    expect(second.result.current.data).toBe("cached")
  })

  it("does not cache a failed load", async () => {
    const load = vi.fn().mockRejectedValue(new Error("load failed"))
    const first = renderHook(() =>
      useAsyncResource<string>(load, [], { cacheKey: "settings:player:user-1" })
    )
    await waitFor(() => expect(first.result.current.error).toBeDefined())
    first.unmount()

    const secondLoad = vi.fn().mockResolvedValue("later")
    const second = renderHook(() =>
      useAsyncResource<string>(secondLoad, [], {
        cacheKey: "settings:player:user-1",
      })
    )

    expect(second.result.current.data).toBeUndefined()
    expect(second.result.current.isLoading).toBe(true)
  })

  it("does not keep the previous resource's error after dependencies change", async () => {
    const failure = new Error("load failed")
    const load = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValue("second")
    const { result, rerender } = renderHook(
      ({ bucket }: { bucket: number }) =>
        useAsyncResource<string>(load, [bucket], {
          cacheKey: "settings:security:user-1",
        }),
      { initialProps: { bucket: 1 } }
    )
    await waitFor(() => expect(result.current.error).toBe(failure))

    rerender({ bucket: 2 })

    await waitFor(() => expect(result.current.data).toBe("second"))
    expect(result.current.error).toBeUndefined()
  })

  it("updates the error when a retry fails again", async () => {
    const firstFailure = new Error("load failed")
    const secondFailure = new Error("retry failed")
    const load = vi
      .fn()
      .mockRejectedValueOnce(firstFailure)
      .mockRejectedValueOnce(secondFailure)
    const { result } = renderHook(() =>
      useAsyncResource<string>(load, [], { cacheKey: "settings:usage:user-1" })
    )
    await waitFor(() => expect(result.current.error).toBe(firstFailure))

    await act(async () => {
      await result.current.retry()
    })

    expect(result.current.error).toBe(secondFailure)
    expect(result.current.data).toBeUndefined()
    expect(result.current.isLoading).toBe(false)
  })

  it("surfaces a failed poll while keeping live data, then clears when a poll succeeds", async () => {
    vi.useFakeTimers()
    const failure = new Error("poll failed")
    const load = vi
      .fn()
      .mockResolvedValueOnce("first")
      .mockRejectedValueOnce(failure)
      .mockResolvedValue("third")
    const { result, unmount } = renderHook(() =>
      useAsyncResource<string>(load, [], { pollIntervalMs: 1000 })
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.data).toBe("first")
    expect(result.current.error).toBeUndefined()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(result.current.error).toBe(failure)
    expect(result.current.data).toBe("first")
    expect(result.current.isLoading).toBe(false)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(result.current.error).toBeUndefined()
    expect(result.current.data).toBe("third")

    unmount()
  })

  it("does not surface a stale load's error after dependencies change", async () => {
    const pending: Array<{
      resolve: (value: string) => void
      reject: (reason: Error) => void
    }> = []
    const load = vi.fn(
      () =>
        new Promise<string>((resolve, reject) => {
          pending.push({ resolve, reject })
        })
    )
    const { result, rerender } = renderHook(
      ({ bucket }: { bucket: number }) =>
        useAsyncResource<string>(load, [bucket], {
          cacheKey: "settings:security:user-1",
        }),
      { initialProps: { bucket: 1 } }
    )

    rerender({ bucket: 2 })
    await act(async () => {
      pending[0]?.reject(new Error("stale load failed"))
    })
    expect(result.current.error).toBeUndefined()
    expect(result.current.isLoading).toBe(true)

    await act(async () => {
      pending[1]?.resolve("current")
    })
    expect(result.current.data).toBe("current")
    expect(result.current.error).toBeUndefined()
    expect(result.current.isLoading).toBe(false)
  })

  it("does not apply a retry result after dependencies change", async () => {
    const initialFailure = new Error("initial load failed")
    let resolveRetry!: (value: string) => void
    let resolveCurrent!: (value: string) => void
    const retryPromise = new Promise<string>((resolve) => {
      resolveRetry = resolve
    })
    const currentPromise = new Promise<string>((resolve) => {
      resolveCurrent = resolve
    })
    const load = vi
      .fn()
      .mockRejectedValueOnce(initialFailure)
      .mockReturnValueOnce(retryPromise)
      .mockReturnValueOnce(currentPromise)
    const { result, rerender } = renderHook(
      ({ bucket }: { bucket: number }) =>
        useAsyncResource<string>(load, [bucket], {
          cacheKey: "settings:security:user-1",
        }),
      { initialProps: { bucket: 1 } }
    )

    await waitFor(() => expect(result.current.error).toBe(initialFailure))
    let retryRequest: Promise<void> | undefined
    act(() => {
      retryRequest = result.current.retry()
    })
    expect(result.current.isLoading).toBe(true)

    rerender({ bucket: 2 })
    resolveRetry("stale retry")
    await act(async () => {
      await retryRequest
    })

    expect(result.current.data).toBeUndefined()
    expect(result.current.error).toBeUndefined()
    expect(result.current.isLoading).toBe(true)

    resolveCurrent("current")
    await act(async () => {
      await currentPromise
    })

    expect(result.current.data).toBe("current")
    expect(result.current.error).toBeUndefined()
    expect(result.current.isLoading).toBe(false)
  })

  it("does not apply a retry error after dependencies change", async () => {
    const initialFailure = new Error("initial load failed")
    let rejectRetry!: (reason: Error) => void
    let resolveCurrent!: (value: string) => void
    const retryPromise = new Promise<string>((_resolve, reject) => {
      rejectRetry = reject
    })
    const currentPromise = new Promise<string>((resolve) => {
      resolveCurrent = resolve
    })
    const load = vi
      .fn()
      .mockRejectedValueOnce(initialFailure)
      .mockReturnValueOnce(retryPromise)
      .mockReturnValueOnce(currentPromise)
    const { result, rerender } = renderHook(
      ({ bucket }: { bucket: number }) =>
        useAsyncResource<string>(load, [bucket], {
          cacheKey: "settings:security:user-1",
        }),
      { initialProps: { bucket: 1 } }
    )

    await waitFor(() => expect(result.current.error).toBe(initialFailure))
    let retryRequest: Promise<void> | undefined
    act(() => {
      retryRequest = result.current.retry()
    })
    rerender({ bucket: 2 })

    rejectRetry(new Error("stale retry failed"))
    await act(async () => {
      await retryRequest
    })

    expect(result.current.data).toBeUndefined()
    expect(result.current.error).toBeUndefined()
    expect(result.current.isLoading).toBe(true)

    resolveCurrent("current")
    await act(async () => {
      await currentPromise
    })

    expect(result.current.data).toBe("current")
    expect(result.current.error).toBeUndefined()
    expect(result.current.isLoading).toBe(false)
  })

  it("does not apply a retry result after a poll supersedes it", async () => {
    vi.useFakeTimers()
    const initialFailure = new Error("initial load failed")
    let resolveRetry!: (value: string) => void
    let resolvePoll!: (value: string) => void
    const retryPromise = new Promise<string>((resolve) => {
      resolveRetry = resolve
    })
    const pollPromise = new Promise<string>((resolve) => {
      resolvePoll = resolve
    })
    const load = vi
      .fn()
      .mockRejectedValueOnce(initialFailure)
      .mockReturnValueOnce(retryPromise)
      .mockReturnValueOnce(pollPromise)
    const { result, unmount } = renderHook(() =>
      useAsyncResource<string>(load, [], { pollIntervalMs: 1000 })
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.error).toBe(initialFailure)
    let retryRequest: Promise<void> | undefined
    act(() => {
      retryRequest = result.current.retry()
    })
    expect(result.current.isLoading).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(load).toHaveBeenCalledTimes(3)

    resolveRetry("stale retry")
    await act(async () => {
      await retryRequest
    })
    expect(result.current.data).toBeUndefined()
    expect(result.current.error).toBe(initialFailure)
    expect(result.current.isLoading).toBe(true)

    resolvePoll("current poll")
    await act(async () => {
      await pollPromise
    })
    expect(result.current.data).toBe("current poll")
    expect(result.current.error).toBeUndefined()
    expect(result.current.isLoading).toBe(false)

    unmount()
  })

  it("does not cache a retry result after unmount", async () => {
    const initialFailure = new Error("initial load failed")
    let resolveRetry!: (value: string) => void
    const retryPromise = new Promise<string>((resolve) => {
      resolveRetry = resolve
    })
    const load = vi
      .fn()
      .mockRejectedValueOnce(initialFailure)
      .mockReturnValueOnce(retryPromise)
    const first = renderHook(() =>
      useAsyncResource<string>(load, [], {
        cacheKey: "settings:security:user-1",
      })
    )

    await waitFor(() => expect(first.result.current.error).toBe(initialFailure))
    let retryRequest: Promise<void> | undefined
    act(() => {
      retryRequest = first.result.current.retry()
    })
    expect(first.result.current.isLoading).toBe(true)
    first.unmount()

    resolveRetry("stale retry")
    await act(async () => {
      await retryRequest
    })

    const secondLoad = vi.fn().mockResolvedValue("current")
    const second = renderHook(() =>
      useAsyncResource<string>(secondLoad, [], {
        cacheKey: "settings:security:user-1",
      })
    )

    expect(second.result.current.data).toBeUndefined()
    expect(secondLoad).toHaveBeenCalledOnce()
  })
})
