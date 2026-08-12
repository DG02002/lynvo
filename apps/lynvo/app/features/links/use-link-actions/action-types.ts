import type {
  ExtractedLink,
  MetaData,
  LinkViewItem,
} from "~/features/links/types"
import type { PluginDomainSuggestion } from "~/lib/plugin-domain"
import type { SavedLinkInteractionReporter } from "~/features/links/saved-link-interaction"

export interface OpenSelectionDialogOptions {
  originalUrl: string
  links: ExtractedLink[]
  meta: MetaData
  existingItemId?: string
  pluginDomainSuggestion?: PluginDomainSuggestion
}

export interface SaveFlowResult {
  pluginDomainSuggestion?: PluginDomainSuggestion
}

export interface ExtractionPreview {
  meta: MetaData
}

export interface SaveLinkOptions {
  overrideUrl?: string
  currentUrl: string
  links: LinkViewItem[]
  addLink: (
    url: string,
    meta?: MetaData,
    extractedLinks?: ExtractedLink[]
  ) => Promise<string | undefined>
  reporter: SavedLinkInteractionReporter
  shouldAutoSaveAllLinks: boolean
}

export interface ConfirmSelectionOptions {
  selectedLinks: ExtractedLink[]
  originalUrl: string
  meta: MetaData
  existingItemId?: string
  addLink: (
    url: string,
    meta?: MetaData,
    extractedLinks?: ExtractedLink[]
  ) => Promise<string | undefined>
  reporter: SavedLinkInteractionReporter
  pluginDomainSuggestion?: PluginDomainSuggestion
}

export interface SoftRefreshOptions {
  itemUrl: string
  links: LinkViewItem[]
  reporter: SavedLinkInteractionReporter
}

export interface MirrorExpandOptions {
  itemUrl: string
  lazyItemUrl: string
  links: LinkViewItem[]
  reporter: SavedLinkInteractionReporter
}

export interface FolderExpandOptions {
  itemUrl: string
  linkId: string
  linkUrl: string
  links: LinkViewItem[]
  reporter: SavedLinkInteractionReporter
}
