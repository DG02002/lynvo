import type {
  ExtractedLink,
  MetaData,
  RecentLinkViewItem,
} from "~/features/links/types"
import type { SaveFlowEffects } from "./save-flow-effects"
import type { RefreshFlowEffects } from "./refresh-flow-effects"

export interface OpenSelectionDialogOptions {
  originalUrl: string
  links: ExtractedLink[]
  meta: MetaData
  existingItemId?: string
  isDraftMode?: boolean
}

export interface ExtractionPreview {
  meta: MetaData
}

export interface SaveLinkOptions {
  overrideUrl?: string
  currentUrl: string
  recents: RecentLinkViewItem[]
  addRecent: (
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
  addRecent: (
    url: string,
    meta?: MetaData,
    extractedLinks?: ExtractedLink[]
  ) => Promise<string | undefined>
  updateRecentLinks: (url: string, links: ExtractedLink[]) => void
  effects: SaveFlowEffects
}

export interface SoftRefreshOptions {
  itemUrl: string
  recents: RecentLinkViewItem[]
  effects: RefreshFlowEffects
}

export interface MirrorExpandOptions {
  itemUrl: string
  lazyItemUrl: string
  recents: RecentLinkViewItem[]
  effects: RefreshFlowEffects
}

export interface FolderExpandOptions {
  itemUrl: string
  linkId: string
  linkUrl: string
  recents: RecentLinkViewItem[]
  effects: RefreshFlowEffects
}
