import {
  confirmSaveIntent,
  resolveSaveIntent,
} from "~/features/links/save-intent"
import type { ConfirmSelectionOptions, SaveLinkOptions } from "./action-types"

export const saveLink = (options: SaveLinkOptions) => resolveSaveIntent(options)

export const confirmSelectedLinks = (options: ConfirmSelectionOptions) =>
  confirmSaveIntent(options)
