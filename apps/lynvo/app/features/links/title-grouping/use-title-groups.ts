import { useEffect, useState } from "react"
import { useRouteLoaderData } from "react-router"
import type { loader as rootLoader } from "~/root"
import { titleGroupsDataApi } from "./title-groups-api"

interface UseTitleGroupsOptions {
  readonly enabled: boolean
  readonly dataVersion: number
  readonly initialProjection?: TitleProjection
}

export const useTitleGroups = ({
  enabled,
  dataVersion,
  initialProjection,
}: UseTitleGroupsOptions): TitleGroupsState => {
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const userId = rootData?.user?.sub ?? "signed-out"
  const [projection, setProjection] = useState<TitleProjection | undefined>(
    initialProjection
  )
  const [error, setError] = useState<string | undefined>()
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    if (!enabled || userId === "signed-out") {
      setProjection(undefined)
      setError(undefined)
      return
    }
    let didCancel = false
    titleGroupsDataApi
      .list()
      .then((response) => {
        if (!didCancel) {
          setProjection(response.projection)
          setError(undefined)
        }
      })
      .catch((error) => {
        if (!didCancel) {
          setError("Unable to load media library")
          console.error("Unable to load media library", error)
        }
      })
    return () => {
      didCancel = true
    }
  }, [dataVersion, enabled, retryToken, userId])

  useEffect(() => {
    if (!enabled || userId === "signed-out" || !projection) {
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
  }, [enabled, projection, userId])

  return {
    projection,
    error,
    retry: () => setRetryToken((currentToken) => currentToken + 1),
  }
}
