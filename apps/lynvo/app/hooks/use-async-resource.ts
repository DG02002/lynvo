import { useCallback, useEffect, useMemo, useRef, useState } from "react"

export interface AsyncResource<Result> {
  readonly data: Result | undefined
  readonly isLoading: boolean
  readonly error: unknown
  /** Rejects when the load fails; callers can catch the failure. */
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
  const isMountedReference = useRef(false)
  const loadSequenceReference = useRef(0)
  const previousDependencySignal = useRef<object | undefined>(undefined)
  const dependencySignal = useMemo(() => ({}), dependencies)

  useEffect(() => {
    loadReference.current = load
  }, [load])

  useEffect(() => {
    isMountedReference.current = true
    return () => {
      isMountedReference.current = false
    }
  }, [])

  const runLoad = useCallback(
    async ({
      showLoading = false,
      logError = false,
    }: {
      readonly showLoading?: boolean
      readonly logError?: boolean
    } = {}): Promise<void> => {
      const loadSequence = ++loadSequenceReference.current
      const isActive = () =>
        isMountedReference.current &&
        loadSequenceReference.current === loadSequence

      if (showLoading && isActive()) {
        setIsLoading(true)
      }

      let nextData: Result
      try {
        nextData = await loadReference.current()
      } catch (loadError) {
        if (isActive()) {
          setError(loadError ?? new Error("The load failed without an error."))
          if (logError) {
            console.error(loadError)
          }
        }
        throw loadError
      } finally {
        if (isActive()) {
          setIsLoading(false)
        }
      }

      if (!isActive()) {
        return
      }

      if (cacheKey) {
        asyncResourceCache.set(cacheKey, {
          data: nextData,
          cachedAt: Date.now(),
        })
      }
      setData(nextData)
      setError(undefined)
    },
    [cacheKey]
  )

  const reload = useCallback(
    (): Promise<void> => runLoad({ showLoading: true }),
    [runLoad]
  )
  const retry = useCallback(
    (): Promise<void> => runLoad({ showLoading: true }).catch(() => undefined),
    [runLoad]
  )

  useEffect(() => {
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

    if (!(hasFreshCache && !dependenciesChanged)) {
      runLoad({ logError: true }).catch(() => undefined)
    }
    return () => {
      loadSequenceReference.current += 1
    }
  }, [cacheKey, cacheTtlMs, dependencySignal, runLoad])

  useEffect(() => {
    if (!options.pollIntervalMs) {
      return
    }
    const intervalId = window.setInterval(() => {
      runLoad().catch((loadError) => console.error(loadError))
    }, options.pollIntervalMs)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [options.pollIntervalMs, runLoad])

  return { data, isLoading, error, reload, retry }
}
