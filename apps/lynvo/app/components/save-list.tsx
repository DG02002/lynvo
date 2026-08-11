import { useMemo, useState } from "react"
import { LinkInputSection } from "~/components/send-link/LinkInputSection"
import { LinkSelectionDialog } from "~/components/send-link/LinkSelectionDialog"
import { SaveListBrowser } from "~/components/save-list/save-list-browser"
import { useLinkActions } from "~/hooks/useLinkActions"
import { useLinks } from "~/hooks/useLinks"
import { cn } from "~/lib/utils"
import { useSaveListFullscreen } from "~/components/save-list/use-save-list-fullscreen"
import { AddPluginDomainAlertDialog } from "~/components/links/add-plugin-domain-alert-dialog"

const SaveList = () => {
  const [selectedItemUrl, setSelectedItemUrl] = useState<string | null>(null)
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

  useSaveListFullscreen(Boolean(selectedItemUrl))
  const savedUrls = useMemo(
    () => new Set(links.map((link) => link.url)),
    [links]
  )

  return (
    <div
      className={cn(
        "flex min-h-[calc(100vh-4rem)] w-full flex-col gap-6 overflow-x-hidden px-6 py-8 md:px-8 md:py-12 lg:px-10 xl:px-14",
        selectedItemUrl &&
          "fixed inset-0 min-h-svh max-w-none gap-0 overflow-hidden bg-background p-0 md:p-0"
      )}
    >
      {!selectedItemUrl && (
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
          onSelectedItemUrlChange={setSelectedItemUrl}
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
