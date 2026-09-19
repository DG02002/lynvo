import { useMemo, useState, type ReactNode } from "react"

import { AddPluginDomainAlertDialog } from "~/components/links/add-plugin-domain-alert-dialog"
import { GalleryGroupBrowser } from "~/components/save-list/gallery-group-browser"
import { GallerySaveGrid } from "~/components/save-list/gallery-save-grid"
import { SaveListBrowser } from "~/components/save-list/save-list-browser"
import { useGalleryGroupRoute } from "~/components/save-list/use-gallery-group-route"
import { useSaveFolderRoute } from "~/components/save-list/use-save-folder-route"
import { useSaveListFullscreen } from "~/components/save-list/use-save-list-fullscreen"
import { LinkInputSection } from "~/components/send-link/link-input-section"
import { LinkSelectionDialog } from "~/components/send-link/link-selection-dialog"
import { Spinner } from "~/components/spinner"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import type { GalleryGroup } from "~/features/links/media-artwork"
import type { LinkViewItem, SavedLinkListItem } from "~/features/links/types"
import type { InitialSnapshotMeta } from "~/features/links/use-links"
import { useLinkActions } from "~/hooks/use-link-actions"
import { useLinks } from "~/hooks/use-links"
import { useIsTvBroAndroidTv } from "~/lib/client-profile"
import { cn } from "~/lib/utils"

declare global {
  interface SaveListProps {
    readonly initialItems?: LinkViewItem[]
    readonly initialSnapshotMeta?: InitialSnapshotMeta
  }
}

interface SaveListContentOptions {
  readonly isGroupRoute: boolean
  readonly openGalleryGroup: GalleryGroup | undefined
  readonly isGalleryMediaView: boolean
  readonly isFolderRoute: boolean
  readonly galleryGroups: readonly GalleryGroup[] | undefined
  readonly linkItemActions: LinkItemActions
  readonly extractingItems: Set<string>
  readonly isHydrating: boolean
  readonly highlightedId: string | null
  readonly links: SavedLinkListItem[]
  readonly selectedItemUrl: string | null
  readonly openSavedFolder: (itemUrl: string) => void
  readonly closeSavedFolder: () => void
  readonly onExitGroup: () => void
  readonly onOpenGroup: (groupKey: string) => void
}

const renderSaveListContent = ({
  isGroupRoute,
  openGalleryGroup,
  isGalleryMediaView,
  isFolderRoute,
  galleryGroups,
  linkItemActions,
  extractingItems,
  isHydrating,
  highlightedId,
  links,
  selectedItemUrl,
  openSavedFolder,
  closeSavedFolder,
  onExitGroup,
  onOpenGroup,
}: SaveListContentOptions): ReactNode => {
  if (isGroupRoute && openGalleryGroup) {
    return (
      <GalleryGroupBrowser
        group={openGalleryGroup}
        actions={linkItemActions}
        extractingItems={extractingItems}
        onExit={onExitGroup}
        onOpenItem={openSavedFolder}
      />
    )
  }

  if (isGalleryMediaView && !isFolderRoute && galleryGroups) {
    return (
      <GallerySaveGrid
        groups={galleryGroups}
        actions={linkItemActions}
        extractingItems={extractingItems}
        isHydrating={isHydrating}
        highlightedId={highlightedId}
        onOpenItem={openSavedFolder}
        onOpenGroup={onOpenGroup}
      />
    )
  }

  return (
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
      shouldShowRowPosters={isGalleryMediaView}
    />
  )
}

const SaveList = ({ initialItems, initialSnapshotMeta }: SaveListProps) => {
  const isSaveInputHidden = useIsTvBroAndroidTv()
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const hasInitialItems = initialItems !== undefined
  const resolvedInitialSnapshotMeta = useMemo<InitialSnapshotMeta>(
    () => ({
      hasRouteSnapshot:
        initialSnapshotMeta?.hasRouteSnapshot ?? hasInitialItems,
      dataVersion: initialSnapshotMeta?.dataVersion,
    }),
    [
      hasInitialItems,
      initialSnapshotMeta?.dataVersion,
      initialSnapshotMeta?.hasRouteSnapshot,
    ]
  )
  const { links, actions, isLoading, isHydrating } = useLinks({
    initialItems,
    initialSnapshotMeta: resolvedInitialSnapshotMeta,
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
  const {
    isGalleryMediaView,
    galleryGroups,
    openGalleryGroup,
    isGroupRoute,
    isImmersiveRoute,
    exitGroup,
    openGroup,
  } = useGalleryGroupRoute({ links, isFolderRoute, isPending })

  useSaveListFullscreen(isImmersiveRoute)
  const savedUrls = useMemo(
    () => new Set(links.map((link) => link.url)),
    [links]
  )
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
    >
      {!isImmersiveRoute && !isSaveInputHidden && (
        <div className="w-full">
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

      <div className="w-full">
        {renderSaveListContent({
          isGroupRoute,
          openGalleryGroup,
          isGalleryMediaView,
          isFolderRoute,
          galleryGroups,
          linkItemActions,
          extractingItems,
          isHydrating,
          highlightedId,
          links,
          selectedItemUrl,
          openSavedFolder,
          closeSavedFolder,
          onExitGroup: exitGroup,
          onOpenGroup: openGroup,
        })}
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
