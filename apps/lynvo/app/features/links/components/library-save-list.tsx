import { useMemo, useRef } from "react"
import {
  SaveDateGroupSection,
  SAVE_LIST_SECTION_STACK_CLASS,
} from "~/components/save-list/save-date-group-heading"
import {
  SaveListEmptyState,
  SaveListErrorState,
  SaveListLoadingState,
  SaveListStaleState,
} from "~/components/save-list/save-list-state"
import type { LinkListItem } from "~/features/links/types"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import { projectTitleGroups } from "~/features/links/title-grouping/title-group-projection"
import { getUniqueGroupSavedLinks } from "~/features/links/title-grouping/title-group-saved-links"
import { useFlipGrid } from "~/hooks/use-flip-grid"
import { TitleGroupCard } from "./title-group-card"

interface LibrarySaveListProps {
  readonly items: LinkListItem[]
  readonly isPending: boolean
  readonly isLoading?: boolean
  readonly projection?: TitleProjection
  readonly error?: string
  readonly onRetry?: () => void
  readonly actions?: LinkItemActions
}

const POSTER_GRID_CLASS =
  "stagger-children grid grid-cols-3 gap-x-4 gap-y-6 md:grid-cols-6"

const TitleSection = ({
  label,
  groups,
  itemsById,
  actions,
}: {
  readonly label: string
  readonly groups: readonly TitleGroupProjection[]
  readonly itemsById: ReadonlyMap<string, LinkListItem>
  readonly actions?: LinkItemActions
}) => {
  const gridRef = useRef<HTMLDivElement | null>(null)
  useFlipGrid({ containerRef: gridRef, dependency: groups })

  if (groups.length === 0) {
    return null
  }
  return (
    <SaveDateGroupSection
      label={label}
      sectionDataAttributes={{
        "data-layout": "poster-grid",
        "data-layout-guide-target": "library-section",
      }}
    >
      <div
        ref={gridRef}
        className={POSTER_GRID_CLASS}
        data-layout-guide-target="library-grid"
      >
        {groups.map((group) => (
          <TitleGroupCard
            key={group.identityKey}
            group={group}
            savedLinks={getUniqueGroupSavedLinks(group, itemsById)}
            actions={actions}
          />
        ))}
      </div>
    </SaveDateGroupSection>
  )
}

const hasProjectionGroups = (candidate: TitleProjection): boolean =>
  candidate.dateGroups.some((dateGroup) => dateGroup.groups.length > 0) ||
  candidate.unmatchedGroups.length > 0

export const LibrarySaveList = ({
  items,
  isPending,
  isLoading = false,
  projection,
  error,
  onRetry,
  actions,
}: LibrarySaveListProps) => {
  const localProjection = useMemo(() => projectTitleGroups(items), [items])
  const currentProjection = useMemo(() => {
    if (!projection) {
      return localProjection
    }
    const serverSavedLinkIds = new Set<string>()
    for (const dateGroup of projection.dateGroups) {
      for (const group of dateGroup.groups) {
        for (const entry of group.entries) {
          for (const source of entry.sources) {
            serverSavedLinkIds.add(source.savedLinkId)
          }
        }
      }
    }
    for (const group of projection.unmatchedGroups) {
      for (const entry of group.entries) {
        for (const source of entry.sources) {
          serverSavedLinkIds.add(source.savedLinkId)
        }
      }
    }
    const pendingItems = items.filter(
      (item) => item.id && !serverSavedLinkIds.has(item.id)
    )
    if (pendingItems.length === 0) {
      return projection
    }
    const pendingProjection = projectTitleGroups(pendingItems)
    return {
      dateGroups: [
        ...projection.dateGroups,
        ...pendingProjection.dateGroups.filter(
          (pendingDateGroup) =>
            !projection.dateGroups.some(
              (dateGroup) => dateGroup.key === pendingDateGroup.key
            )
        ),
      ],
      unmatchedGroups: [
        ...projection.unmatchedGroups,
        ...pendingProjection.unmatchedGroups,
      ],
    }
  }, [items, localProjection, projection])
  const itemsById = useMemo(
    () =>
      new Map(
        items.flatMap((item) => (item.id ? [[item.id, item] as const] : []))
      ),
    [items]
  )
  const hasCachedProjection = projection !== undefined
  const hasVisibleProjection = hasProjectionGroups(currentProjection)
  if (
    (isPending || isLoading) &&
    !hasCachedProjection &&
    !hasVisibleProjection
  ) {
    return <SaveListLoadingState label="Loading media library" />
  }
  if (error && !hasCachedProjection && !hasVisibleProjection) {
    return <SaveListErrorState onRetry={onRetry} />
  }
  if (!hasVisibleProjection) {
    return <SaveListEmptyState />
  }
  const staleState = error ? <SaveListStaleState onRetry={onRetry} /> : null
  return (
    <>
      {staleState}
      <div className={SAVE_LIST_SECTION_STACK_CLASS}>
        {currentProjection.dateGroups.map((dateGroup) => (
          <TitleSection
            key={dateGroup.key}
            label={dateGroup.label}
            groups={dateGroup.groups}
            itemsById={itemsById}
            actions={actions}
          />
        ))}
        <TitleSection
          label="Unmatched"
          groups={currentProjection.unmatchedGroups}
          itemsById={itemsById}
          actions={actions}
        />
      </div>
    </>
  )
}
