import type { ExtractedLink } from "~/features/links/types"
import { LinkSelectionTreeItem } from "./LinkSelectionTreeItem"

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
  <div className="flex min-w-0 select-none flex-col gap-1">
    {links.map((link, index) => (
      <LinkSelectionTreeItem
        key={link.id || link.url + index}
        link={link}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        onExpandFolder={onExpandFolder}
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
