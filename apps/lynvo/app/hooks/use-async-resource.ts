import { useCallback, useEffect, useRef, useState } from "react"

export interface AsyncResource<Result> {
  readonly data: Result | undefined
  readonly isLoading: boolean
  readonly reload: () => Promise<void>
}

export interface AsyncResourceOptions {
  readonly pollIntervalMs?: number
}

const areDependenciesEqual = (
  previousDependencies: readonly unknown[],
  nextDependencies: readonly unknown[]
): boolean => {
  if (previousDependencies.length !== nextDependencies.length) {
    return false
  }
  for (let index = 0; index < previousDependencies.length; index += 1) {
    if (!Object.is(previousDependencies[index], nextDependencies[index])) {
      return false
    }
  }
  return true
}

export const useAsyncResource = <Result>(
  load: () => Promise<Result>,
  dependencies: readonly unknown[] = [],
  options: AsyncResourceOptions = {}
): AsyncResource<Result> => {
  const [data, setData] = useState<Result | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)
  const loadReference = useRef(load)
  loadReference.current = load

  const previousDependenciesReference = useRef(dependencies)
  const [dependencyVersion, setDependencyVersion] = useState(0)

  if (
    !areDependenciesEqual(previousDependenciesReference.current, dependencies)
  ) {
    previousDependenciesReference.current = dependencies
    setDependencyVersion((currentVersion) => currentVersion + 1)
  }

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
  }, [dependencyVersion, runLoad])

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
