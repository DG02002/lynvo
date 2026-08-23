import type {
  ExtractedLink,
  MetaData,
  LinkViewItem,
} from "~/features/links/types"
import type { PluginDomainSuggestion } from "~/lib/plugin-domain"
import type { SavedLinkInteractionReporter } from "~/features/links/saved-link-interaction"
import type {
  ConfirmSaveIntentOptions,
  SaveIntentOptions,
} from "~/features/links/save-intent"

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

export interface SaveLinkOptions extends SaveIntentOptions {}

export interface ConfirmSelectionOptions extends ConfirmSaveIntentOptions {}

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
