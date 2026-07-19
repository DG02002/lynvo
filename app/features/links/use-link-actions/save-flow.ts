import { toast } from "sonner"
import { readDraft, deleteDraft } from "~/components/links/DraftManager"
import { extractionOrchestration } from "~/lib/extraction/orchestration"
import { vibrateSaveStart, vibrateSaveSuccess } from "./save-feedback"
import { isProbablyValidUrl, normalizeUrl } from "./url-utils"
import type { ConfirmSelectionOptions, SaveLinkOptions } from "./action-types"

export const saveLink = async ({
  overrideUrl,
  currentUrl,
  recents,
  addRecent,
  effects,
}: SaveLinkOptions) => {
  const rawUrl = overrideUrl ?? currentUrl
  const targetUrl = normalizeUrl(rawUrl || "")

  if (!targetUrl) {
    effects.showError("Please enter a URL.")
    return
  }
  if (!isProbablyValidUrl(targetUrl)) {
    effects.showError("Please enter a valid URL.")
    return
  }
  effects.clearError()
  effects.clearPreview()

  const existingDraft = readDraft(targetUrl)
  if (existingDraft) {
    effects.openSelection({
      originalUrl: targetUrl,
      links: existingDraft.links,
      meta: existingDraft.meta,
      isDraftMode: true,
    })
    return
  }

  const existingItem = recents.find(
    (recentItem) => recentItem.url === targetUrl
  )
  if (existingItem) {
    effects.showError("Link already exists on your account.")
    effects.focusRecent(existingItem.id || existingItem.url)
    return
  }

  vibrateSaveStart()

  const metadata = await extractionOrchestration.getSourceMetadata(
    targetUrl,
    recents
  )
  effects.showPreview(metadata)

  if (metadata.filename?.toLowerCase().endsWith(".rar")) {
    effects.showError("RAR archives cannot be saved as individual files.")
    effects.clearPreview()
    return
  }

  const { mergedMeta, presentation } =
    await extractionOrchestration.prepareSource({
      targetUrl,
      recents,
      sourceMetadata: metadata,
    })

  if (presentation.kind === "error") {
    effects.showError(presentation.message)
    effects.clearPreview()
    return
  }

  if (presentation.kind === "selectionDialog") {
    effects.openSelection({
      originalUrl: targetUrl,
      links: presentation.links,
      meta: mergedMeta,
    })
    return
  }

  const newId = await addRecent(targetUrl, mergedMeta, [presentation.link])
  effects.focusRecent(newId || targetUrl)

  effects.resetAfterSave()
  effects.clearPreview()
  vibrateSaveSuccess()
}

export const confirmSelectedLinks = async ({
  selectedLinks,
  originalUrl,
  meta,
  existingItemId,
  addRecent,
  updateRecentLinks,
  effects,
}: ConfirmSelectionOptions) => {
  if (existingItemId) {
    updateRecentLinks(originalUrl, selectedLinks)
    toast.success("Links updated")
  } else {
    await addRecent(originalUrl, meta, selectedLinks)
  }

  deleteDraft(originalUrl)
  effects.closeSelection()
  effects.resetAfterSave()
  vibrateSaveSuccess()
}
