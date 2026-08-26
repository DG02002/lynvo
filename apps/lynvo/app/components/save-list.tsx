import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router"
import { LinkInputSection } from "~/components/send-link/link-input-section"
import { LinkSelectionDialog } from "~/components/send-link/link-selection-dialog"
import { DevDemoDataControls } from "~/components/dev-demo-data-controls"
import { SaveListBrowser } from "~/components/save-list/save-list-browser"
import { HybridSaveGrid } from "~/components/save-list/hybrid-save-grid"
import { HybridGroupBrowser } from "~/components/save-list/hybrid-group-browser"
import { useLinkActions } from "~/hooks/use-link-actions"
import { useLinks } from "~/hooks/use-links"
import { cn } from "~/lib/utils"
import { useSaveListFullscreen } from "~/components/save-list/use-save-list-fullscreen"
import { AddPluginDomainAlertDialog } from "~/components/links/add-plugin-domain-alert-dialog"
import { useSaveFolderRoute } from "~/components/save-list/use-save-folder-route"
import { Spinner } from "~/components/spinner"
import { LibrarySaveList } from "~/features/links/components/library-save-list"
import { useTitleGroups } from "~/features/links/title-grouping/use-title-groups"
import { getHybridCardGroups } from "~/features/links/media-artwork/hybrid-card-grouping"
import { useLibraryMediaView } from "~/features/site/settings/library-media-view-preference"
import { getDemoSavedLinkSeeds } from "~/features/links/dev-demo-data"
import {
  shouldHideSaveInput,
  useIsTvBroAndroidTv,
  useShouldHideTvBroSaveInput,
} from "~/features/site/settings/tvbro-save-input-preference"
import type { LinkViewItem } from "~/features/links/types"

declare global {
  interface SaveListProps {
    readonly initialItems?: LinkViewItem[]
    readonly initialDataVersion?: number
    readonly initialTitleProjection?: TitleProjection
  }
}

const SaveList = ({
  initialItems,
  initialDataVersion,
  initialTitleProjection,
}: SaveListProps) => {
  const isTvBroAndroidTv = useIsTvBroAndroidTv()
  const shouldHideTvBroSaveInput = useShouldHideTvBroSaveInput()
  const mediaView = useLibraryMediaView()
  const [searchParams, setSearchParams] = useSearchParams()
  const isSaveInputHidden = shouldHideSaveInput(
    isTvBroAndroidTv,
    shouldHideTvBroSaveInput
  )
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const { links, actions, isLoading, isHydrating, dataVersion } = useLinks({
    initialItems,
    initialDataVersion,
    hasInitialSnapshot: initialItems !== undefined,
  })
  const isPending = isHydrating || isLoading
  const { selectedItemUrl, isFolderRoute, openSavedFolder, closeSavedFolder } =
    useSaveFolderRoute(links, isPending)
  const {
    input,
    isSaving,
    extractingItems,
    linkItemActions,
    selectionDialog,
    pluginDomainDialog,
  } = useLinkActions({
    links,
    linkActions: actions,
    setHighlightedId,
  })

  const titleGroupsState = useTitleGroups({
    enabled: mediaView === "library" && !isFolderRoute,
    dataVersion,
    initialProjection: initialTitleProjection,
  })
  const isHybridMediaView = mediaView === "hybrid"
  const hybridGroupKey = isHybridMediaView ? searchParams.get("group") : null
  const hybridCardGroups = useMemo(
    () =>
      isHybridMediaView && !isFolderRoute
        ? getHybridCardGroups(links)
        : undefined,
    [isHybridMediaView, isFolderRoute, links]
  )
  const openHybridGroup = hybridCardGroups?.find(
    (group) => group.key === hybridGroupKey
  )
  const isGroupRoute = hybridGroupKey !== null
  const isImmersiveRoute = isFolderRoute || isGroupRoute

  useEffect(() => {
    if (hybridGroupKey && !isPending && !openHybridGroup) {
      setSearchParams({}, { replace: true })
    }
  }, [hybridGroupKey, isPending, openHybridGroup, setSearchParams])

  useSaveListFullscreen(isImmersiveRoute)
  const savedUrls = useMemo(
    () => new Set(links.map((link) => link.url)),
    [links]
  )
  const handleLoadDemoLinks = async () => {
    for (const demoLink of getDemoSavedLinkSeeds()) {
      const savedLinkId = await actions.add(
        demoLink.url,
        demoLink.meta,
        demoLink.extractedLinks
      )
      if (!savedLinkId) {
        throw new Error(`Unable to save demo link ${demoLink.url}`)
      }
    }
  }

  if (isImmersiveRoute && isPending) {
    return (
      <div
        className="fixed inset-0 flex min-h-svh items-center justify-center bg-background"
        role="status"
        aria-label="Loading saved folder…"
      >
        <Spinner aria-hidden="true" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex min-h-[calc(100vh-4rem)] w-full flex-col overflow-x-hidden",
        isImmersiveRoute
          ? "fixed inset-0 min-h-svh max-w-none gap-0 overflow-hidden bg-background"
          : "gap-6 px-6 py-8 md:px-8 md:py-12 lg:px-10 xl:px-14"
      )}
      data-layout-guide-target="save-frame"
    >
      {!isImmersiveRoute && !isSaveInputHidden && (
        <div className="w-full" data-layout-guide-target="save-input">
          <LinkInputSection
            url={input.url}
            setUrl={input.setUrl}
            onSave={input.handleSave}
            isSaving={isSaving}
            extractionPreview={input.extractionPreview}
            error={input.error}
            setError={input.setError}
            savedUrls={savedUrls}
          />
        </div>
      )}
      {import.meta.env.DEV && !isImmersiveRoute && (
        <DevDemoDataControls onLoad={handleLoadDemoLinks} />
      )}

      <div className="w-full" data-layout-guide-target="save-content">
        {mediaView === "library" && !isFolderRoute ? (
          <LibrarySaveList
            items={links}
            isPending={isPending}
            isLoading={titleGroupsState.isLoading}
            projection={titleGroupsState.projection}
            error={titleGroupsState.error}
            onRetry={titleGroupsState.retry}
            actions={linkItemActions}
          />
        ) : isGroupRoute && openHybridGroup ? (
          <HybridGroupBrowser
            group={openHybridGroup}
            actions={linkItemActions}
            extractingItems={extractingItems}
            onExit={() => setSearchParams({}, { replace: true })}
            onOpenItem={openSavedFolder}
          />
        ) : isHybridMediaView && !isFolderRoute && hybridCardGroups ? (
          <HybridSaveGrid
            groups={hybridCardGroups}
            actions={linkItemActions}
            extractingItems={extractingItems}
            isHydrating={isHydrating}
            highlightedId={highlightedId}
            onOpenItem={openSavedFolder}
            onOpenGroup={(groupKey) => setSearchParams({ group: groupKey })}
          />
        ) : (
          <SaveListBrowser
            items={links}
            selectedItemUrl={selectedItemUrl}
            onSelectedItemUrlChange={(itemUrl) =>
              itemUrl ? openSavedFolder(itemUrl) : closeSavedFolder()
            }
            actions={linkItemActions}
            extractingItems={extractingItems}
            highlightedId={highlightedId}
            isHydrating={isHydrating}
            shouldShowRowPosters={mediaView === "hybrid"}
          />
        )}
      </div>

      <LinkSelectionDialog
        open={selectionDialog.state.open}
        onOpenChange={selectionDialog.setOpen}
        links={selectionDialog.state.links}
        onConfirm={selectionDialog.confirmSelection}
        onExpandFolder={selectionDialog.expandFolder}
        pluginIcon={selectionDialog.display.pluginIcon}
        pluginName={selectionDialog.display.pluginName}
        pageTitle={selectionDialog.display.pageTitle}
        audioInfo={selectionDialog.display.audioInfo}
      />
      <AddPluginDomainAlertDialog
        suggestion={pluginDomainDialog.suggestion}
        isAdding={pluginDomainDialog.isAdding}
        onAdd={pluginDomainDialog.add}
        onDismiss={pluginDomainDialog.dismiss}
      />
    </div>
  )
}

export default SaveList
