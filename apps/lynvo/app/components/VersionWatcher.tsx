import * as React from "react"
import { z } from "zod"
import { VERSION_WATCH_INTERVAL_MS } from "~/lib/constants"

const versionResponseSchema = z.object({
  buildTime: z.string().min(1),
})

type VersionWatcherProps = {
  buildTime: string
}

export function VersionWatcher({ buildTime }: VersionWatcherProps) {
  const [deployedBuildTime, setDeployedBuildTime] = React.useState<
    string | undefined
  >(undefined)

  React.useEffect(() => {
    let didCancel = false
    const checkVersion = async () => {
      try {
        const response = await fetch("/api/version", {
          headers: { Accept: "application/json" },
        })
        if (!response.ok) {
          throw new Error("Unable to check the current version")
        }
        const result = versionResponseSchema.safeParse(await response.json())
        if (!result.success) {
          throw new Error("The version endpoint returned an invalid response")
        }
        if (!didCancel) {
          setDeployedBuildTime(result.data.buildTime)
        }
      } catch (error) {
        console.error(error)
      }
    }
    void checkVersion()
    const intervalId = window.setInterval(
      checkVersion,
      VERSION_WATCH_INTERVAL_MS
    )
    return () => {
      didCancel = true
      window.clearInterval(intervalId)
    }
  }, [])

  React.useEffect(() => {
    if (deployedBuildTime && deployedBuildTime !== buildTime) {
      window.location.reload()
    }
  }, [deployedBuildTime, buildTime])

  return null
}
