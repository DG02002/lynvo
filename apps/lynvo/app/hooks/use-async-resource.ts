import { useCallback, useEffect, useMemo, useRef, useState } from "react"

export interface AsyncResource<Result> {
  readonly data: Result | undefined
  readonly isLoading: boolean
  readonly reload: () => Promise<void>
}

export interface AsyncResourceOptions {
  readonly pollIntervalMs?: number
}

export const useAsyncResource = <Result>(
  load: () => Promise<Result>,
  dependencies: readonly unknown[] = [],
  options: AsyncResourceOptions = {}
): AsyncResource<Result> => {
  const [data, setData] = useState<Result | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)
  const loadReference = useRef(load)
  const dependencySignal = useMemo(() => ({}), dependencies)

  useEffect(() => {
    loadReference.current = load
  }, [load])

  const runLoad = useCallback(async (): Promise<void> => {
    try {
      setData(await loadReference.current())
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let didCancel = false
    runLoad().catch((error) => {
      if (!didCancel) {
        console.error(error)
      }
    })
    return () => {
      didCancel = true
    }
  }, [dependencySignal, runLoad])

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

  return { data, isLoading, reload: runLoad }
}
