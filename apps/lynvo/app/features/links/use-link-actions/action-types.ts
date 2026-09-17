import type { SavedLinkInteractionReporter } from "~/features/links/saved-link-interaction"
import type {
  ExtractedLink,
  MetaData,
  LinkViewItem,
} from "~/features/links/types"
import type { PluginDomainSuggestion } from "~/lib/plugin-domain"

export interface OpenSelectionDialogOptions {
  originalUrl: string
  links: ExtractedLink[]
  meta: MetaData
  existingItemId?: string
  pluginDomainSuggestion?: PluginDomainSuggestion
}

export interface ExtractionPreview {
  meta: MetaData
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
