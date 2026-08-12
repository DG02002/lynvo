import { useMemo } from "react"
import { LinkInputSection } from "~/components/send-link/LinkInputSection"
import { LinkSelectionDialog } from "~/components/send-link/LinkSelectionDialog"
import { SaveListBrowser } from "~/components/save-list/save-list-browser"
import { useLinkActions } from "~/hooks/useLinkActions"
import { useLinks } from "~/hooks/useLinks"
import { cn } from "~/lib/utils"
import { useSaveListFullscreen } from "~/components/save-list/use-save-list-fullscreen"
import { AddPluginDomainAlertDialog } from "~/components/links/add-plugin-domain-alert-dialog"
import { useSaveFolderRoute } from "~/components/save-list/use-save-folder-route"
import { Spinner } from "~/components/ui/spinner"
import {
  shouldHideSaveInput,
  useIsTvBroAndroidTv,
  useShouldHideTvBroSaveInput,
} from "~/features/site/settings/tvbro-save-input-preference"

const SaveList = () => {
  const isTvBroAndroidTv = useIsTvBroAndroidTv()
  const shouldHideTvBroSaveInput = useShouldHideTvBroSaveInput()
  const isSaveInputHidden = shouldHideSaveInput(
    isTvBroAndroidTv,
    shouldHideTvBroSaveInput
  )
  const {
    links,
    setCurrentPage,
    setSortOrder,
    highlightedId,
    setHighlightedId,
    actions,
    user,
    isHydrating,
  } = useLinks()
  const { selectedItemUrl, isFolderRoute, openSavedFolder, closeSavedFolder } =
    useSaveFolderRoute(links, isHydrating)
  const {
    input,
    isSaving,
    extractingItems,
    linkItemActions,
    selectionDialog,
    pluginDomainDialog,
  } = useLinkActions({
    userId: user?.sub ?? "signed-out",
    links,
    linkActions: actions,
    setHighlightedId,
    setSortOrder,
    setCurrentPage,
  })

  useSaveListFullscreen(isFolderRoute)
  const savedUrls = useMemo(
    () => new Set(links.map((link) => link.url)),
    [links]
  )

  if (isFolderRoute && isHydrating) {
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
        isFolderRoute
          ? "fixed inset-0 min-h-svh max-w-none gap-0 overflow-hidden bg-background"
          : "gap-6 px-6 py-8 md:px-8 md:py-12 lg:px-10 xl:px-14"
      )}
    >
      {!isFolderRoute && !isSaveInputHidden && (
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
        />
      </div>

      <LinkSelectionDialog
        open={selectionDialog.state.open}
        onOpenChange={selectionDialog.setOpen}
        links={selectionDialog.state.links}
        onConfirm={selectionDialog.confirmSelection}
        onSaveDraft={selectionDialog.saveSelectionDraft}
        onExpandFolder={selectionDialog.expandFolder}
        pluginIcon={selectionDialog.display.pluginIcon}
        pluginName={selectionDialog.display.pluginName}
        pageTitle={selectionDialog.display.pageTitle}
        audioInfo={selectionDialog.display.audioInfo}
        isDraftMode={selectionDialog.display.isDraftMode}
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
