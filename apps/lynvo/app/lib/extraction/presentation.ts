import {
  getMediaNodeInteractionState,
  isMirrorResolvableMediaNode,
} from "~/features/links/media-node-interaction"
import type { ExtractedLink } from "~/features/links/types"

interface DirectSavePresentation {
  readonly kind: "directSave"
  readonly link: ExtractedLink
}

interface SelectionDialogPresentation {
  readonly kind: "selectionDialog"
  readonly links: ExtractedLink[]
}

interface ErrorPresentation {
  readonly kind: "error"
  readonly message: string
}

export type SavePresentation =
  | DirectSavePresentation
  | SelectionDialogPresentation
  | ErrorPresentation

export const decideSavePresentation = (
  links: ReadonlyArray<ExtractedLink>
): SavePresentation => {
  if (links.length === 0) {
    return {
      kind: "error",
      message:
        "This Source page doesn’t contain any links Lynvo can open. Try a different link.",
    }
  }

  const directFiles = links.filter(
    (link) =>
      !getMediaNodeInteractionState(link).isFolder ||
      isMirrorResolvableMediaNode(link)
  )
  const hasFolder = links.length !== directFiles.length

  if (hasFolder || directFiles.length > 1) {
    return { kind: "selectionDialog", links: [...links] }
  }

  if (directFiles.length === 1) {
    return { kind: "directSave", link: directFiles[0] }
  }

  return {
    kind: "error",
    message:
      "Links were found, but none can be opened in Just (Video) Player, VLC for Android, MPV, or MX Player. Try another Source page.",
  }
}
