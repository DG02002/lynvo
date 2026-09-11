import { useCallback, useEffect, useMemo, useRef, useState } from "react"

export interface AsyncResource<Result> {
  readonly data: Result | undefined
  readonly isLoading: boolean
  readonly error: unknown
  readonly reload: () => Promise<void>
  /** Never rejects; failures surface through error. */
  readonly retry: () => Promise<void>
}

export interface AsyncResourceOptions {
  readonly pollIntervalMs?: number
  readonly cacheKey?: string
  readonly cacheTtlMs?: number
}

const DEFAULT_CACHE_TTL_MS = 30_000

interface AsyncResourceCacheEntry {
  readonly data: unknown
  readonly cachedAt: number
}

const asyncResourceCache = new Map<string, AsyncResourceCacheEntry>()

const getCacheEntry = <Result>(
  cacheKey: string | undefined
): (AsyncResourceCacheEntry & { readonly data: Result }) | undefined => {
  if (!cacheKey) {
    return undefined
  }
  const entry = asyncResourceCache.get(cacheKey)
  // SAFETY: the caller owns the opaque cache key and stores one Result type under it.
  return entry as
    | (AsyncResourceCacheEntry & { readonly data: Result })
    | undefined
}

export const clearAsyncResourceCache = (cacheKey?: string): void => {
  if (cacheKey) {
    asyncResourceCache.delete(cacheKey)
    return
  }
  asyncResourceCache.clear()
}

export const clearAsyncResourceCacheWhere = (
  predicate: (cacheKey: string) => boolean
): void => {
  for (const cacheKey of asyncResourceCache.keys()) {
    if (predicate(cacheKey)) {
      asyncResourceCache.delete(cacheKey)
    }
  }
}

export const useAsyncResource = <Result>(
  load: () => Promise<Result>,
  dependencies: readonly unknown[] = [],
  options: AsyncResourceOptions = {}
): AsyncResource<Result> => {
  const { cacheKey, cacheTtlMs = DEFAULT_CACHE_TTL_MS } = options
  const initialCacheEntry = getCacheEntry<Result>(cacheKey)
  const [data, setData] = useState<Result | undefined>(initialCacheEntry?.data)
  const [isLoading, setIsLoading] = useState(!initialCacheEntry)
  const [error, setError] = useState<unknown>(undefined)
  const loadReference = useRef(load)
  const previousDependencySignal = useRef<object | undefined>(undefined)
  const dependencySignal = useMemo(() => ({}), dependencies)

  useEffect(() => {
    loadReference.current = load
  }, [load])

  const runLoad = useCallback(
    async (isActive: () => boolean = () => true): Promise<void> => {
      let nextData: Result
      try {
        nextData = await loadReference.current()
      } catch (loadError) {
        // Awaiting callers catch the rejection; components render the error state.
        if (isActive()) {
          setError(loadError ?? new Error("The load failed without an error."))
        }
        throw loadError
      } finally {
        if (isActive()) {
          setIsLoading(false)
        }
      }
      if (cacheKey) {
        asyncResourceCache.set(cacheKey, {
          data: nextData,
          cachedAt: Date.now(),
        })
      }
      if (isActive()) {
        setData(nextData)
        setError(undefined)
      }
    },
    [cacheKey]
  )

  const retry = useCallback(async (): Promise<void> => {
    try {
      await runLoad()
    } catch {}
  }, [runLoad])

  useEffect(() => {
    let didCancel = false
    const dependenciesChanged =
      previousDependencySignal.current !== undefined &&
      previousDependencySignal.current !== dependencySignal
    previousDependencySignal.current = dependencySignal
    const cachedEntry = getCacheEntry<Result>(cacheKey)
    const hasFreshCache =
      cachedEntry !== undefined &&
      Date.now() - cachedEntry.cachedAt < cacheTtlMs

    if (cachedEntry) {
      setData(cachedEntry.data)
      setIsLoading(false)
    } else {
      setData(undefined)
      setIsLoading(true)
    }
    setError(undefined)

    if (hasFreshCache && !dependenciesChanged) {
      return () => {
        didCancel = true
      }
    }

    runLoad(() => !didCancel).catch((error) => {
      if (!didCancel) {
        console.error(error)
      }
    })
    return () => {
      didCancel = true
    }
  }, [cacheKey, cacheTtlMs, dependencySignal, runLoad])

  useEffect(() => {
    if (!options.pollIntervalMs) {
      return
    }
    const intervalId = window.setInterval(() => {
      runLoad().catch((error) => console.error(error))
    }, options.pollIntervalMs)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [options.pollIntervalMs, runLoad])

  return { data, isLoading, error, reload: runLoad, retry }
}
