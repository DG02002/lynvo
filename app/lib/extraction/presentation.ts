import type { ExtractedLink } from "~/features/links/types"

export interface DirectSavePresentation {
  readonly kind: "directSave"
  readonly link: ExtractedLink
}

export interface SelectionDialogPresentation {
  readonly kind: "selectionDialog"
  readonly links: ExtractedLink[]
}

export interface ErrorPresentation {
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
    return { kind: "error", message: "No links found on this page." }
  }

  const singleLink = links.length === 1 ? links[0] : undefined
  if (singleLink?.workerNodeKind === "resolvable") {
    return { kind: "directSave", link: singleLink }
  }

  const hasFolder = links.some((link) => link.type === "folder")
  const directFiles = links.filter((link) => link.type !== "folder")

  if (hasFolder || directFiles.length > 1) {
    return { kind: "selectionDialog", links: [...links] }
  }

  if (directFiles.length === 1) {
    return { kind: "directSave", link: directFiles[0] }
  }

  return { kind: "error", message: "No playable links found on this page." }
}
