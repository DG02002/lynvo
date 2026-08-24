import {
  getSaveDateGroupKey,
  getSaveDateGroupLabel,
} from "~/lib/save-date-groups"
import type { LinkListItem } from "~/features/links/types"

export interface SaveListDateGroup {
  key: string
  label: string
  items: LinkListItem[]
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
    const label = getSaveDateGroupLabel(item.timestamp, currentTimeMs)
    const key = getSaveDateGroupKey(item.timestamp, currentTimeMs)
    const currentGroup = groups.get(key)
    if (currentGroup) {
      currentGroup.items.push(item)
      continue
    }
    groups.set(key, { key, label, items: [item] })
  }

  return [...groups.values()]
}
