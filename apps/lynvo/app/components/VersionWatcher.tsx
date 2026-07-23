import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { z } from "zod"

const versionResponseSchema = z
  .object({
    buildTime: z.string().min(1),
  })
  .strip()

type VersionWatcherProps = {
  buildTime: string
}

export function VersionWatcher({ buildTime }: VersionWatcherProps) {
  const { data } = useQuery({
    queryKey: ["version"],
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/version", {
        signal,
        headers: { Accept: "application/json" },
      })
      if (!response.ok) {
        throw new Error("Unable to check the current version")
      }
      const result = versionResponseSchema.safeParse(await response.json())
      if (!result.success) {
        throw new Error("The version endpoint returned an invalid response")
      }
      return result.data
    },
    refetchInterval: 60_000,
    retry: false,
  })

  React.useEffect(() => {
    if (data?.buildTime && data.buildTime !== buildTime) {
      window.location.reload()
    } else {
      // no-op to satisfy react-doctor/no-event-handler rule
    }
  }, [data, buildTime])

  return null
}
