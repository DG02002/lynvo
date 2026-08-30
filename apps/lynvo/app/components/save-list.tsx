import { useMemo, useState, type ReactNode } from "react"
import { LinkInputSection } from "~/components/send-link/link-input-section"
import { LinkSelectionDialog } from "~/components/send-link/link-selection-dialog"
import { SaveListBrowser } from "~/components/save-list/save-list-browser"
import { HybridSaveGrid } from "~/components/save-list/hybrid-save-grid"
import { HybridGroupBrowser } from "~/components/save-list/hybrid-group-browser"
import { useHybridGroupRoute } from "~/components/save-list/use-hybrid-group-route"
import { useLinkActions } from "~/hooks/use-link-actions"
import { useLinks } from "~/hooks/use-links"
import { cn } from "~/lib/utils"
import { useSaveListFullscreen } from "~/components/save-list/use-save-list-fullscreen"
import { AddPluginDomainAlertDialog } from "~/components/links/add-plugin-domain-alert-dialog"
import { useSaveFolderRoute } from "~/components/save-list/use-save-folder-route"
import { Spinner } from "~/components/spinner"
import {
  shouldHideSaveInput,
  useIsTvBroAndroidTv,
  useShouldHideTvBroSaveInput,
} from "~/features/site/settings/tvbro-save-input-preference"
import type { LinkItemActions } from "~/features/links/link-item-actions"
import type { LinkViewItem, SavedLinkListItem } from "~/features/links/types"

declare global {
  interface SaveListProps {
    readonly initialItems?: LinkViewItem[]
    readonly initialDataVersion?: number
  }
}

interface SaveListContentOptions {
  readonly isGroupRoute: boolean
  readonly openHybridGroup: HybridCardGroup | undefined
  readonly isHybridMediaView: boolean
  readonly isFolderRoute: boolean
  readonly hybridCardGroups: readonly HybridCardGroup[] | undefined
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
  openHybridGroup,
  isHybridMediaView,
  isFolderRoute,
  hybridCardGroups,
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
  if (isGroupRoute && openHybridGroup) {
    return (
      <HybridGroupBrowser
        group={openHybridGroup}
        actions={linkItemActions}
        extractingItems={extractingItems}
        onExit={onExitGroup}
        onOpenItem={openSavedFolder}
      />
    )
  }

  if (isHybridMediaView && !isFolderRoute && hybridCardGroups) {
    return (
      <HybridSaveGrid
        groups={hybridCardGroups}
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
      shouldShowRowPosters={isHybridMediaView}
    />
  )
}

const SaveList = ({ initialItems, initialDataVersion }: SaveListProps) => {
  const isTvBroAndroidTv = useIsTvBroAndroidTv()
  const shouldHideTvBroSaveInput = useShouldHideTvBroSaveInput()
  const isSaveInputHidden = shouldHideSaveInput(
    isTvBroAndroidTv,
    shouldHideTvBroSaveInput
  )
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const { links, actions, isLoading, isHydrating } = useLinks({
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
  const {
    isHybridMediaView,
    hybridCardGroups,
    openHybridGroup,
    isGroupRoute,
    isImmersiveRoute,
    exitGroup,
    openGroup,
  } = useHybridGroupRoute({ links, isFolderRoute, isPending })

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
          openHybridGroup,
          isHybridMediaView,
          isFolderRoute,
          hybridCardGroups,
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
