const LINK_DEBUG_LOG_ENTRY_LIMIT = 20

export const appendLinkDebugLog = <Entry>(
  previous: readonly Entry[] | undefined,
  entry: Entry
): Entry[] => [...(previous ?? []), entry].slice(-LINK_DEBUG_LOG_ENTRY_LIMIT)
