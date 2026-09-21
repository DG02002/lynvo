import { getMediaNodeKey } from "~/features/links/media-node-interaction"
import type { ExtractedLink } from "~/features/links/types"

import { LinkSelectionTreeItem } from "./link-selection-tree-item"

interface LinkSelectionTreeProps {
  links: ExtractedLink[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onExpandFolder?: (linkId: string, linkUrl: string) => Promise<boolean>
}

export const LinkSelectionTree = ({
  links,
  selectedIds,
  onToggleSelect,
  onExpandFolder,
}: LinkSelectionTreeProps) => (
  <div
    role="tree"
    aria-label="Choose links to save"
    className="flex min-w-0 select-none flex-col gap-1"
  >
    {links.map((link, index) => (
      <LinkSelectionTreeItem
        key={getMediaNodeKey(link)}
        link={link}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        onExpandFolder={onExpandFolder}
        level={1}
        positionInSet={index + 1}
        setSize={links.length}
      />
    ))}
    {links.length === 0 && (
      <div className="p-8 text-center text-muted-foreground">
        No links are available to select. Close this window and try a different
        link.
      </div>
    )}
  </div>
)
