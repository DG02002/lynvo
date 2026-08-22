import * as React from "react"
import { DAY_MS } from "../../workers/constants"

export const MINUTE_MS = 60 * 1000

export const getTimeBucket = (timestamp: number, intervalMs: number) =>
  Math.floor(timestamp / intervalMs) * intervalMs

export const getDailyTimeBucket = (timestamp: number) =>
  getTimeBucket(timestamp, DAY_MS)

const useCoarseTimeBucket = (intervalMs: number) => {
  const [timeBucket, setTimeBucket] = React.useState(() =>
    getTimeBucket(Date.now(), intervalMs)
  )

  React.useEffect(() => {
    const now = Date.now()
    const nextBoundary = getTimeBucket(now, intervalMs) + intervalMs
    const timeout = window.setTimeout(() => {
      setTimeBucket(getTimeBucket(Date.now(), intervalMs))
    }, nextBoundary - now)
    return () => window.clearTimeout(timeout)
  }, [intervalMs, timeBucket])

  return timeBucket
}

export const useDailyTimeBucket = () => useCoarseTimeBucket(DAY_MS)

export const useMinuteTimeBucket = () => useCoarseTimeBucket(MINUTE_MS)
