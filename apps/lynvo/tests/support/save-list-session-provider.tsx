import type { PropsWithChildren } from "react"

import { SaveListSessionProvider } from "~/components/save-list/save-list-session"
import type { LinkItemActions } from "~/features/links/link-item-actions"

interface SaveListSessionTestProviderProps extends PropsWithChildren {
  readonly actions: LinkItemActions
  readonly extractingItems: Set<string>
  readonly highlightedId?: string | null
  readonly isHydrating?: boolean
  readonly shouldShowRowPosters?: boolean
}

export const SaveListSessionTestProvider = ({
  children,
  actions,
  extractingItems,
  highlightedId = null,
  isHydrating = false,
  shouldShowRowPosters = false,
}: SaveListSessionTestProviderProps) => (
  <SaveListSessionProvider
    actions={actions}
    extractingItems={extractingItems}
    highlightedId={highlightedId}
    isHydrating={isHydrating}
    shouldShowRowPosters={shouldShowRowPosters}
  >
    {children}
  </SaveListSessionProvider>
)
