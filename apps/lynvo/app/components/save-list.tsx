import { useState } from "react"
import { useDraftSweep } from "~/components/links/DraftManager"
import { LinkInputSection } from "~/components/send-link/LinkInputSection"
import { LinkSelectionDialog } from "~/components/send-link/LinkSelectionDialog"
import { SaveListBrowser } from "~/components/save-list/save-list-browser"
import { useLinkActions } from "~/hooks/useLinkActions"
import { useRecentLinks } from "~/hooks/useRecentLinks"
import { cn } from "~/lib/utils"
import { useSaveListFullscreen } from "~/components/save-list/use-save-list-fullscreen"
import { AddSourceDomainAlertDialog } from "~/components/links/add-source-domain-alert-dialog"

const SaveList = () => {
  useDraftSweep()

  const [selectedItemUrl, setSelectedItemUrl] = useState<string | null>(null)
  const {
    recents,
    setCurrentPage,
    setSortOrder,
    highlightedId,
    setHighlightedId,
    actions,
    isHydrating,
  } = useRecentLinks()
  const {
    input,
    isSaving,
    extractingItems,
    linkCardActions,
    selectionDialog,
    pluginDomainDialog,
  } = useLinkActions({
    recents,
    recentLinks: actions,
    setHighlightedId,
    setSortOrder,
    setCurrentPage,
  })

  useSaveListFullscreen(Boolean(selectedItemUrl))

  return (
    <div
      className={cn(
        "mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col gap-6 overflow-x-hidden px-4 py-8 md:px-8 md:py-12",
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
          />
        </div>
      )}

      <div className="w-full">
        <SaveListBrowser
          items={recents}
          selectedItemUrl={selectedItemUrl}
          onSelectedItemUrlChange={setSelectedItemUrl}
          actions={linkCardActions}
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
        workerId={selectionDialog.display.workerId}
      />
      <AddSourceDomainAlertDialog
        suggestion={pluginDomainDialog.suggestion}
        isAdding={pluginDomainDialog.isAdding}
        onAdd={pluginDomainDialog.add}
        onDismiss={pluginDomainDialog.dismiss}
      />
    </div>
  )
}

export default SaveList
