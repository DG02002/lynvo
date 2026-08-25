import { useEffect, useRef, useState } from "react"
import { useRouteLoaderData } from "react-router"
import type { loader as rootLoader } from "~/root"
import { titleGroupsDataApi } from "./title-groups-api"

export const useTitleGroupsWithRuntime = (
  { enabled, dataVersion, initialProjection }: UseTitleGroupsOptions,
  { userId, dataSource }: UseTitleGroupsRuntime
): TitleGroupsState => {
  const resolvedUserId = userId ?? "signed-out"
  const [projection, setProjection] = useState<TitleProjection | undefined>(
    initialProjection
  )
  const [error, setError] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(
    enabled && resolvedUserId !== "signed-out" && !initialProjection
  )
  const [retryToken, setRetryToken] = useState(0)
  const projectionOwnerRef = useRef<string | undefined>(
    resolvedUserId === "signed-out" ? undefined : resolvedUserId
  )

  useEffect(() => {
    const projectionOwner =
      resolvedUserId === "signed-out" ? undefined : resolvedUserId
    if (projectionOwnerRef.current !== projectionOwner) {
      projectionOwnerRef.current = projectionOwner
      setProjection(undefined)
      setError(undefined)
    }
    if (resolvedUserId === "signed-out") {
      setProjection(undefined)
      setError(undefined)
      setIsLoading(false)
      return
    }
    if (!enabled) {
      setError(undefined)
      setIsLoading(false)
      return
    }

    let didCancel = false
    setIsLoading(true)
    dataSource
      .list()
      .then((response) => {
        if (!didCancel) {
          setProjection(response.projection)
          setError(undefined)
          setIsLoading(false)
        }
      })
      .catch((error) => {
        if (!didCancel) {
          setError("Unable to load media library")
          setIsLoading(false)
          console.error("Unable to load media library", error)
        }
      })
    return () => {
      didCancel = true
    }
  }, [dataSource, dataVersion, enabled, resolvedUserId, retryToken])

  useEffect(() => {
    if (!enabled || resolvedUserId === "signed-out" || !projection) {
      return
    }
    const hasPending =
      projection.dateGroups.some((group) =>
        group.groups.some(
          (titleGroup) => titleGroup.metadataState === "pending"
        )
      ) ||
      projection.unmatchedGroups.some(
        (titleGroup) => titleGroup.metadataState === "pending"
      )
    if (!hasPending) {
      return
    }
    const timer = setTimeout(() => {
      setRetryToken((currentToken) => currentToken + 1)
    }, 2500)
    return () => clearTimeout(timer)
  }, [enabled, projection, resolvedUserId])

  return {
    projection,
    error,
    isLoading,
    retry: () => setRetryToken((currentToken) => currentToken + 1),
  }
}

export const useTitleGroups = (options: UseTitleGroupsOptions) => {
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  return useTitleGroupsWithRuntime(options, {
    userId: rootData?.user?.sub,
    dataSource: titleGroupsDataApi,
  })
}
