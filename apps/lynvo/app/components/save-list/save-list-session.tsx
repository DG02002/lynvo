import { createContext, useContext, useMemo, type ReactNode } from "react"

import type { LinkItemActions } from "~/features/links/link-item-actions"

export interface SaveListSession {
  readonly actions: LinkItemActions
  readonly extractingItems: Set<string>
  readonly highlightedId: string | null
  readonly isHydrating: boolean
  readonly shouldShowRowPosters: boolean
}

interface SaveListSessionProviderProps extends SaveListSession {
  readonly children: ReactNode
}

const SaveListSessionContext = createContext<SaveListSession | null>(null)

export const SaveListSessionProvider = ({
  children,
  actions,
  extractingItems,
  highlightedId,
  isHydrating,
  shouldShowRowPosters,
}: SaveListSessionProviderProps) => {
  const session = useMemo(
    () => ({
      actions,
      extractingItems,
      highlightedId,
      isHydrating,
      shouldShowRowPosters,
    }),
    [actions, extractingItems, highlightedId, isHydrating, shouldShowRowPosters]
  )

  return (
    <SaveListSessionContext.Provider value={session}>
      {children}
    </SaveListSessionContext.Provider>
  )
}

export const useSaveListSession = (): SaveListSession => {
  const session = useContext(SaveListSessionContext)
  if (session === null) {
    throw new Error(
      "useSaveListSession must be used within a SaveListSessionProvider"
    )
  }
  return session
}
