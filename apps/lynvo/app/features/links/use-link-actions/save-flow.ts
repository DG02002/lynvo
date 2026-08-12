import { extractionOrchestration } from "~/lib/extraction/orchestration"
import { vibrateSaveStart, vibrateSaveSuccess } from "./save-feedback"
import { isProbablyValidUrl, normalizeUrl } from "./url-utils"
import type { ConfirmSelectionOptions, SaveLinkOptions } from "./action-types"
import {
  parsePluginDomainCandidate,
  type PluginDomainSuggestion,
} from "~/lib/plugin-domain"

export const saveLink = async ({
  overrideUrl,
  currentUrl,
  links,
  addLink,
  reporter,
  shouldAutoSaveAllLinks,
}: SaveLinkOptions) => {
  const rawUrl = overrideUrl ?? currentUrl
  const targetUrl = normalizeUrl(rawUrl || "")
  const pluginDomainCandidate = parsePluginDomainCandidate(targetUrl)
  const savedUrl = pluginDomainCandidate?.sanitizedUrl ?? targetUrl

  if (!targetUrl) {
    reporter.publish({ kind: "error", message: "Enter a URL." })
    return
  }
  if (!isProbablyValidUrl(targetUrl)) {
    reporter.publish({ kind: "error", message: "Enter a valid URL." })
    return
  }
  reporter.publish({ kind: "clear-error" })
  reporter.publish({ kind: "clear-preview" })

  const existingItem = links.find((linkItem) => linkItem.url === savedUrl)
  if (existingItem) {
    reporter.publish({
      kind: "error",
      message: "Link already exists on your account.",
    })
    reporter.publish({
      kind: "link-focused",
      linkId: existingItem.id || existingItem.url,
    })
    return
  }

  vibrateSaveStart()

  const metadata = await extractionOrchestration.getSourceMetadata(
    targetUrl,
    links
  )
  reporter.publish({ kind: "preview", meta: metadata })

  if (metadata.filename?.toLowerCase().endsWith(".rar")) {
    reporter.publish({
      kind: "error",
      message: "RAR archives cannot be saved as individual files.",
    })
    reporter.publish({ kind: "clear-preview" })
    return
  }

  const { mergedMeta, presentation } =
    await extractionOrchestration.prepareSource({
      targetUrl,
      links,
      sourceMetadata: metadata,
    })
  const pluginDomainSuggestion: PluginDomainSuggestion | undefined =
    pluginDomainCandidate &&
    mergedMeta.pluginId &&
    mergedMeta.pluginServerId &&
    mergedMeta.sourceCredentialKind
      ? {
          ...pluginDomainCandidate,
          pluginIconUrl: mergedMeta.sourceIconUrl ?? mergedMeta.pluginIcon,
          pluginId: mergedMeta.pluginId,
          pluginName:
            mergedMeta.sourceName ??
            mergedMeta.pluginName ??
            mergedMeta.pluginId,
          pluginServerId: mergedMeta.pluginServerId,
        }
      : undefined

  if (presentation.kind === "error") {
    reporter.publish({ kind: "error", message: presentation.message })
    reporter.publish({ kind: "clear-preview" })
    return
  }

  if (presentation.kind === "selectionDialog") {
    if (shouldAutoSaveAllLinks) {
      const newId = await addLink(savedUrl, mergedMeta, presentation.links)
      reporter.publish({ kind: "link-focused", linkId: newId || savedUrl })
      reporter.publish({ kind: "view-reset" })
      reporter.publish({ kind: "clear-preview" })
      vibrateSaveSuccess()
      return { pluginDomainSuggestion }
    }
    reporter.publish({
      kind: "selection-required",
      selection: {
        originalUrl: savedUrl,
        pluginDomainSuggestion,
        links: presentation.links,
        meta: mergedMeta,
      },
    })
    return
  }

  const newId = await addLink(savedUrl, mergedMeta, [presentation.link])
  reporter.publish({ kind: "link-focused", linkId: newId || savedUrl })
  reporter.publish({ kind: "view-reset" })
  reporter.publish({ kind: "clear-preview" })
  vibrateSaveSuccess()
  return {
    pluginDomainSuggestion,
  }
}

export const confirmSelectedLinks = async ({
  selectedLinks,
  originalUrl,
  meta,
  existingItemId,
  addLink,
  reporter,
  pluginDomainSuggestion,
}: ConfirmSelectionOptions) => {
  if (existingItemId) {
    reporter.publish({
      kind: "links-updated",
      itemUrl: originalUrl,
      links: selectedLinks,
    })
  } else {
    await addLink(originalUrl, meta, selectedLinks)
  }

  reporter.publish({ kind: "selection-closed" })
  reporter.publish({ kind: "view-reset" })
  vibrateSaveSuccess()
  return { pluginDomainSuggestion }
}
