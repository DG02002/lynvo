import {
  MILLISECONDS_PER_DAY,
  SAVE_LIST_OLDER_AFTER_DAY_COUNT,
} from "~/lib/constants"

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
})

const getLocalDayNumber = (date: Date): number =>
  Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())

const getDateAgeInDays = (timestamp: number, currentTimeMs: number): number => {
  const itemDayNumber = getLocalDayNumber(new Date(timestamp))
  const currentDayNumber = getLocalDayNumber(new Date(currentTimeMs))
  return Math.max(
    0,
    Math.round((currentDayNumber - itemDayNumber) / MILLISECONDS_PER_DAY)
  )
}

export const getSaveDateGroupLabel = (
  timestamp: number,
  currentTimeMs: number
): string => {
  const ageInDays = getDateAgeInDays(timestamp, currentTimeMs)
  if (ageInDays === 0) {
    return "Today"
  }
  if (ageInDays >= SAVE_LIST_OLDER_AFTER_DAY_COUNT) {
    return "Older"
  }
  return WEEKDAY_FORMATTER.format(new Date(timestamp))
}

export const getSaveDateGroupKey = (
  timestamp: number,
  currentTimeMs: number
): string => {
  const label = getSaveDateGroupLabel(timestamp, currentTimeMs)
  if (label === "Older") {
    return "older"
  }
  const date = new Date(timestamp)
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("-")
}
