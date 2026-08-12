import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Effect } from "effect"
import { useOptionalRealtime } from "~/context/RealtimeContext"
import { client } from "~/lib/effect/api/client"
import { SAVED_LINK_ANTI_ENTROPY_INTERVAL_MS } from "../constants"
import { savedLinksQueryKey } from "./query"

export const useSavedLinkRealtimeSynchronization = (
  userId: string | undefined,
  revision: number | undefined
) => {
  const queryClient = useQueryClient()
  const realtime = useOptionalRealtime()
  const revisionRef = useRef(revision ?? 0)

  useEffect(() => {
    revisionRef.current = revision ?? 0
  }, [revision])

  useEffect(() => {
    if (!userId || !realtime) {
      return
    }
    const invalidate = () =>
      queryClient.invalidateQueries({
        queryKey: savedLinksQueryKey(userId),
        refetchType: "active",
      })
    const unsubscribe = realtime.subscribe((message) => {
      if (
        message.type === "saved-links.changed" &&
        message.payload.revision > revisionRef.current
      ) {
        void invalidate()
      }
    })
    return unsubscribe
  }, [queryClient, realtime, userId])

  useEffect(() => {
    if (userId && realtime && realtime.connectionGeneration > 0) {
      void queryClient.invalidateQueries({
        queryKey: savedLinksQueryKey(userId),
        refetchType: "active",
      })
    }
  }, [queryClient, realtime, userId])

  useEffect(() => {
    if (!userId) {
      return
    }
    const reconcile = () => {
      void queryClient.invalidateQueries({
        queryKey: savedLinksQueryKey(userId),
        refetchType: "active",
      })
    }
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        reconcile()
      }
    }
    window.addEventListener("online", reconcile)
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      window.removeEventListener("online", reconcile)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [queryClient, userId])

  useEffect(() => {
    if (!userId) {
      return
    }
    const checkRevision = async () => {
      if (!navigator.onLine || document.visibilityState !== "visible") {
        return
      }
      const response = await Effect.runPromise(client.links.revision())
      if (response.revision > revisionRef.current) {
        await queryClient.invalidateQueries({
          queryKey: savedLinksQueryKey(userId),
          refetchType: "active",
        })
      }
    }
    const timer = window.setInterval(() => {
      void checkRevision().catch(console.error)
    }, SAVED_LINK_ANTI_ENTROPY_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [queryClient, userId])
}
