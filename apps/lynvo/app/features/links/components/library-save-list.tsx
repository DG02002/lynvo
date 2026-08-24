import { useMemo, useRef } from "react"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Skeleton } from "~/components/ui/skeleton"
import {
  SaveDateGroupSection,
  SAVE_LIST_SECTION_STACK_CLASS,
} from "~/components/save-list/save-date-group-heading"
import type { LinkListItem } from "~/features/links/types"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import { projectTitleGroups } from "~/features/links/title-grouping/title-group-projection"
import { useFlipGrid } from "~/hooks/use-flip-grid"
import { TitleGroupCard } from "./title-group-card"

interface LibrarySaveListProps {
  readonly items: LinkListItem[]
  readonly isPending: boolean
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
        {groups.map((group) => {
          const savedLinkId = group.entries[0]?.sources[0]?.savedLinkId
          return (
            <TitleGroupCard
              key={group.identityKey}
              group={group}
              item={savedLinkId ? itemsById.get(savedLinkId) : undefined}
              actions={actions}
            />
          )
        })}
      </div>
    </SaveDateGroupSection>
  )
}

const LoadingState = () => (
  <div
    className={POSTER_GRID_CLASS}
    aria-label="Loading media library"
    role="status"
  >
    {Array.from({ length: 12 }, (_, cardIndex) => (
      <div key={cardIndex}>
        <Skeleton className="aspect-2/3 rounded-3xl" />
        <Skeleton className="mt-3 h-5 w-4/5" />
        <Skeleton className="mt-2 h-4 w-3/5" />
      </div>
    ))}
  </div>
)

const hasProjectionGroups = (candidate: TitleProjection): boolean =>
  candidate.dateGroups.some((dateGroup) => dateGroup.groups.length > 0) ||
  candidate.unmatchedGroups.length > 0

export const LibrarySaveList = ({
  items,
  isPending,
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
  if (isPending) {
    return <LoadingState />
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn’t load your media library</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          <span>Your saved links are safe. Try loading the library again.</span>
          {onRetry && (
            <button
              type="button"
              className="font-medium underline underline-offset-4"
              onClick={onRetry}
            >
              Try again
            </button>
          )}
        </AlertDescription>
      </Alert>
    )
  }
  if (!hasProjectionGroups(currentProjection)) {
    return (
      <Alert>
        <AlertTitle>No saved media yet</AlertTitle>
        <AlertDescription>
          Save a movie, show, or folder to organize it here.
        </AlertDescription>
      </Alert>
    )
  }
  return (
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
  )
}
