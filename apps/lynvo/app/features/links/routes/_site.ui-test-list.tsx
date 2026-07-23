import { useMemo, useReducer } from "react"
import type { Route } from "./+types/_site.ui-test-list"
import { SaveListBrowser } from "~/components/save-list/save-list-browser"
import { LinkSelectionDialog } from "~/components/send-link/LinkSelectionDialog"
import { Button } from "~/components/ui/button"
import type { LinkCardActions } from "~/features/links/link-card-actions"
import type { ExtractedLink, RecentLinkViewItem } from "~/features/links/types"
import { withWatchedUrl } from "~/features/links/link-playback-metadata"
import { getRecentLinkViewItemMetadata } from "~/features/links/link-metadata-accessors"
import { useSaveListFullscreen } from "~/components/save-list/use-save-list-fullscreen"
import { cn } from "~/lib/utils"
import { TEST_MIRROR_RESOLUTION_DELAY_MS } from "~/features/links/testing/constants"
import { removeLinkFromTree } from "~/features/links/link-tree-metadata"
import { createSaveListTestItems } from "~/features/links/testing/save-list-test-fixtures"

export const meta = (_: Route.MetaArgs) => [
  { title: "Save List UI Test | Lynvo" },
]

export const loader = () => ({
  user: {
    sub: "save-list-test-user",
    username: "Save List Tester",
    sid: "save-list-test-session",
  },
})

interface SaveListUiTestState {
  items: RecentLinkViewItem[]
  selectedItemUrl: string | null
  highlightedId: string | null
  isHydrating: boolean
  showEmptyList: boolean
  extractingItems: Set<string>
  events: string[]
  selectionItemUrl: string | null
}

interface SaveListUiTestStateAction {
  update: (currentState: SaveListUiTestState) => SaveListUiTestState
}

const createInitialState = (): SaveListUiTestState => ({
  items: createSaveListTestItems(),
  selectedItemUrl: null,
  highlightedId: "nested-library",
  isHydrating: false,
  showEmptyList: false,
  extractingItems: new Set(),
  events: [],
  selectionItemUrl: null,
})

const stateReducer = (
  currentState: SaveListUiTestState,
  action: SaveListUiTestStateAction
) => action.update(currentState)

const SaveListUiTestRoute = () => {
  const [state, dispatch] = useReducer(
    stateReducer,
    undefined,
    createInitialState
  )
  const {
    items,
    selectedItemUrl,
    highlightedId,
    isHydrating,
    showEmptyList,
    extractingItems,
    events,
    selectionItemUrl,
  } = state
  const updateField = <Field extends keyof SaveListUiTestState>(
    field: Field,
    update: (
      currentValue: SaveListUiTestState[Field]
    ) => SaveListUiTestState[Field]
  ) => {
    dispatch({
      update: (currentState) => ({
        ...currentState,
        [field]: update(currentState[field]),
      }),
    })
  }
  const setItems = (
    update: (items: RecentLinkViewItem[]) => RecentLinkViewItem[]
  ) => updateField("items", update)
  const setSelectedItemUrl = (url: string | null) =>
    updateField("selectedItemUrl", () => url)
  const toggleIsHydrating = () =>
    updateField("isHydrating", (currentValue) => !currentValue)
  const setShowEmptyList = (value: boolean) =>
    updateField("showEmptyList", () => value)
  const setExtractingItems = (update: (items: Set<string>) => Set<string>) =>
    updateField("extractingItems", update)
  const setEvents = (update: (events: string[]) => string[]) =>
    updateField("events", update)
  const setSelectionItemUrl = (url: string | null) =>
    updateField("selectionItemUrl", () => url)
  const selectionItem = items.find((item) => item.url === selectionItemUrl)
  const selectionMetadata = selectionItem
    ? getRecentLinkViewItemMetadata(selectionItem)
    : undefined
  useSaveListFullscreen(Boolean(selectedItemUrl))

  const recordEvent = (event: string) => {
    setEvents((currentEvents) => [event, ...currentEvents].slice(0, 8))
  }

  const actions = useMemo<LinkCardActions>(
    () => ({
      play: (target) =>
        recordEvent(
          `Play: ${typeof target === "string" ? target : target.label}`
        ),
      remove: (url) => {
        setItems((currentItems) =>
          currentItems.filter((item) => item.url !== url)
        )
        updateField("selectedItemUrl", (currentUrl) =>
          currentUrl === url ? null : currentUrl
        )
        recordEvent(`Remove: ${url}`)
      },
      showLinks: (url) => {
        setSelectionItemUrl(url)
        recordEvent(`Open selection: ${url}`)
      },
      markWatched: (itemUrl, linkUrl) => {
        setItems((currentItems) =>
          currentItems.map((item) =>
            item.url === itemUrl
              ? {
                  ...item,
                  metadata: withWatchedUrl(item.metadata ?? item.meta, linkUrl),
                }
              : item
          )
        )
        recordEvent(`Mark watched: ${linkUrl}`)
      },
      removeLink: (itemUrl, linkKey, linkUrl) => {
        setItems((currentItems) =>
          currentItems.map((item) => {
            if (item.url !== itemUrl) {
              return item
            }
            const metadata = getRecentLinkViewItemMetadata(item)
            return {
              ...item,
              metadata: {
                ...metadata,
                extraction: {
                  ...metadata.extraction,
                  extractedLinks: removeLinkFromTree(
                    metadata.extraction.extractedLinks,
                    linkKey
                  ),
                },
                playback: {
                  ...metadata.playback,
                  watchedUrls: metadata.playback.watchedUrls.filter(
                    (watchedUrl) => watchedUrl !== linkUrl
                  ),
                  watchedIds: metadata.playback.watchedIds.filter(
                    (watchedId) => watchedId !== linkKey
                  ),
                },
              },
            }
          })
        )
        recordEvent(`Remove nested link: ${linkKey}`)
      },
      expandFolder: async (_, linkId, linkUrl) => {
        setExtractingItems((currentItems) => new Set(currentItems).add(linkUrl))
        recordEvent(`Resolve folder: ${linkId}`)
        return null
      },
      softRefresh: (url) => recordEvent(`Refresh: ${url}`),
      hardRefresh: (url) => recordEvent(`Re-select: ${url}`),
      expandMirror: async (_, lazyItemUrl) => {
        setExtractingItems((currentItems) =>
          new Set(currentItems).add(lazyItemUrl)
        )
        await new Promise((resolve) =>
          setTimeout(resolve, TEST_MIRROR_RESOLUTION_DELAY_MS)
        )
        setExtractingItems((currentItems) => {
          const nextItems = new Set(currentItems)
          nextItems.delete(lazyItemUrl)
          return nextItems
        })
        recordEvent(`Resolve mirrors: ${lazyItemUrl}`)
        if (lazyItemUrl.includes("resolution-failure")) {
          return null
        }
        const mirrors: ExtractedLink[] = [
          {
            id: `${lazyItemUrl}-route-alpha`,
            url: `${lazyItemUrl}/route-alpha`,
            label: "Play from Source Route Alpha",
            type: "file",
            status: "up",
          },
          {
            id: `${lazyItemUrl}-route-beta`,
            url: `${lazyItemUrl}/route-beta`,
            label: "Play from Source Route Beta Server",
            type: "file",
            status: "up",
          },
          {
            id: `${lazyItemUrl}-route-gamma`,
            url: `${lazyItemUrl}/route-gamma`,
            label: "Play from CF Server (404)",
            type: "file",
            status: "down",
          },
        ]
        return mirrors
      },
      setAsCurrent: (_, lazyItemUrl) =>
        recordEvent(`Set current: ${lazyItemUrl}`),
    }),
    []
  )

  return (
    <main
      className={cn(
        "mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8",
        selectedItemUrl &&
          "fixed inset-0 min-h-svh max-w-none gap-0 overflow-hidden bg-background p-0 md:p-0"
      )}
    >
      {!selectedItemUrl && (
        <header className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl font-medium">Save list UI test</h1>
            <p className="text-sm text-muted-foreground">
              Dedicated edge cases for the current save-list browser.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowEmptyList(false)}>
              Populated
            </Button>
            <Button variant="outline" onClick={() => setShowEmptyList(true)}>
              Empty list
            </Button>
            <Button variant="outline" onClick={toggleIsHydrating}>
              {isHydrating ? "Stop loading" : "Loading state"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                dispatch({ update: createInitialState })
              }}
            >
              Reset
            </Button>
          </div>
        </header>
      )}

      <SaveListBrowser
        items={showEmptyList ? [] : items}
        selectedItemUrl={selectedItemUrl}
        onSelectedItemUrlChange={setSelectedItemUrl}
        actions={actions}
        extractingItems={extractingItems}
        highlightedId={highlightedId}
        isHydrating={isHydrating}
      />

      {!selectedItemUrl && events.length > 0 && (
        <section
          className="flex flex-col gap-2 border-t pt-4"
          aria-live="polite"
        >
          <h2 className="text-sm font-medium">Recent test actions</h2>
          <ol className="flex flex-col gap-1 text-xs text-muted-foreground">
            {events.map((event, eventIndex) => (
              <li key={`${event}-${eventIndex}`}>{event}</li>
            ))}
          </ol>
        </section>
      )}

      <LinkSelectionDialog
        open={Boolean(selectionItem)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectionItemUrl(null)
          }
        }}
        links={selectionMetadata?.extraction.extractedLinks ?? []}
        onConfirm={(selectedLinks) => {
          if (!selectionItem) {
            return
          }
          setItems((currentItems) =>
            currentItems.map((item) =>
              item.url === selectionItem.url
                ? {
                    ...item,
                    isDraft: false,
                    draftExpiresAt: undefined,
                    metadata: {
                      ...getRecentLinkViewItemMetadata(item),
                      extraction: {
                        ...getRecentLinkViewItemMetadata(item).extraction,
                        extractedLinks: selectedLinks,
                      },
                    },
                  }
                : item
            )
          )
          recordEvent(`Saved ${selectedLinks.length} selected links`)
          setSelectionItemUrl(null)
        }}
        onSaveDraft={() => {
          if (selectionItem) {
            recordEvent("Draft saved without selection state")
          }
        }}
        pluginIcon={
          selectionItem?.pluginIcon ||
          String(selectionMetadata?.source.pluginIcon ?? "") ||
          undefined
        }
        pluginName={
          selectionItem?.sourceName ||
          selectionItem?.pluginName ||
          String(selectionMetadata?.source.pluginName ?? "Link selection")
        }
        pageTitle={
          String(selectionMetadata?.source.pageTitle ?? "") ||
          selectionItem?.title
        }
        audioInfo={String(selectionMetadata?.source.audio ?? "") || undefined}
        isDraftMode={Boolean(selectionItem?.isDraft)}
        workerId={String(selectionMetadata?.source.workerId ?? "") || undefined}
      />
    </main>
  )
}

export default SaveListUiTestRoute
