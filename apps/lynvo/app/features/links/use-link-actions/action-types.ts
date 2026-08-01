import type {
  ExtractedLink,
  MetaData,
  LinkViewItem,
} from "~/features/links/types"
import type { SaveFlowEffects } from "./save-flow-effects"
import type { RefreshFlowEffects } from "./refresh-flow-effects"
import type { PluginDomainSuggestion } from "~/lib/plugin-domain"

export interface OpenSelectionDialogOptions {
  originalUrl: string
  links: ExtractedLink[]
  meta: MetaData
  existingItemId?: string
  isDraftMode?: boolean
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
  effects: SaveFlowEffects
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
  updateLinks: (url: string, links: ExtractedLink[]) => void
  effects: SaveFlowEffects
  pluginDomainSuggestion?: PluginDomainSuggestion
}

export interface SoftRefreshOptions {
  itemUrl: string
  links: LinkViewItem[]
  effects: RefreshFlowEffects
}

export interface MirrorExpandOptions {
  itemUrl: string
  lazyItemUrl: string
  links: LinkViewItem[]
  effects: RefreshFlowEffects
}

export interface FolderExpandOptions {
  itemUrl: string
  linkId: string
  linkUrl: string
  links: LinkViewItem[]
  effects: RefreshFlowEffects
}
