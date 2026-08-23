import {
  MILLISECONDS_PER_DAY,
  SAVE_LIST_OLDER_AFTER_DAY_COUNT,
} from "~/lib/constants"
import type { LinkListItem } from "~/features/links/types"

export interface SaveListDateGroup {
  key: string
  label: string
  items: LinkListItem[]
}

const getLocalDateKey = (date: Date): string =>
  [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("-")

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

const getDateGroupLabel = (
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
  return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(
    new Date(timestamp)
  )
}

export const groupSaveListItems = (
  items: LinkListItem[],
  currentTimeMs = Date.now()
): SaveListDateGroup[] => {
  const groups = new Map<string, SaveListDateGroup>()
  const sortedItems = items.toSorted(
    (firstItem, secondItem) => secondItem.timestamp - firstItem.timestamp
  )

  for (const item of sortedItems) {
    const label = getDateGroupLabel(item.timestamp, currentTimeMs)
    const key =
      label === "Older" ? "older" : getLocalDateKey(new Date(item.timestamp))
    const currentGroup = groups.get(key)
    if (currentGroup) {
      currentGroup.items.push(item)
      continue
    }
    groups.set(key, { key, label, items: [item] })
  }

  return [...groups.values()]
}
