import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  Folder01Icon,
  Folder02Icon,
  FolderSymlinkIcon,
  Video02Icon,
} from "@hugeicons/core-free-icons"
import { Checkbox } from "~/components/ui/checkbox"
import { Spinner } from "~/components/ui/spinner"
import type { ExtractedLink } from "~/features/links/types"
import { cn } from "~/lib/utils"
import { getLinkSelectionState } from "./link-selection-state"

interface LinkSelectionTreeItemProps {
  link: ExtractedLink
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onExpandFolder?: (linkId: string, linkUrl: string) => Promise<boolean>
}

export const LinkSelectionTreeItem = ({
  link,
  selectedIds,
  onToggleSelect,
  onExpandFolder,
}: LinkSelectionTreeItemProps) => {
  const {
    linkId,
    isFolder,
    isSelectable,
    hasChildren,
    canExpand,
    isSelected,
    hasSelectedChild,
  } = getLinkSelectionState(link, selectedIds)
  const [isExpanded, setIsExpanded] = React.useState(hasSelectedChild)
  const [isResolving, setIsResolving] = React.useState(false)
  const canResolve =
    isFolder &&
    !hasChildren &&
    link.childrenResolved !== true &&
    Boolean(onExpandFolder)
  const folderState = !isFolder
    ? undefined
    : isExpanded
      ? "open"
      : link.childrenResolved !== true && !hasChildren
        ? "lazy-closed"
        : "closed"
  const itemIcon = isFolder
    ? folderState === "open"
      ? Folder02Icon
      : folderState === "lazy-closed"
        ? FolderSymlinkIcon
        : Folder01Icon
    : Video02Icon

  const [prevHasSelectedChild, setPrevHasSelectedChild] =
    React.useState(hasSelectedChild)
  if (hasSelectedChild !== prevHasSelectedChild) {
    setPrevHasSelectedChild(hasSelectedChild)
    if (hasSelectedChild) {
      setIsExpanded(true)
    }
  }

  const handleRowAction = async () => {
    if (canExpand) {
      setIsExpanded((current) => !current)
      return
    }
    if (!canResolve || isResolving || !onExpandFolder) {
      return
    }

    setIsResolving(true)
    const didResolve = await onExpandFolder(linkId, link.url)
    setIsResolving(false)
    if (didResolve) {
      setIsExpanded(true)
    }
  }

  const handleCheckedChange = () => {
    if (isSelectable) {
      onToggleSelect(linkId)
    }
  }

  return (
    <div className="flex min-w-0 select-none flex-col">
      <div
        role="treeitem"
        aria-expanded={canExpand || canResolve ? isExpanded : undefined}
        aria-selected={isSelectable ? isSelected : undefined}
        data-folder-state={folderState}
        tabIndex={0}
        className={cn(
          "grid min-w-0 grid-cols-[1.25rem_1.5rem_minmax(0,1fr)_5.5rem] items-center gap-x-3 rounded-lg p-2 text-foreground transition-colors sm:grid-cols-[1.25rem_1.5rem_minmax(0,1fr)_7rem]",
          (canExpand || canResolve) && "hover:bg-muted/50 cursor-pointer",
          !canExpand && !canResolve && "cursor-default",
          isSelected && "bg-muted/30"
        )}
        onClick={() => void handleRowAction()}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return
          }
          event.preventDefault()
          void handleRowAction()
        }}
      >
        <div
          className="flex size-5 items-center justify-center"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {isSelectable && (
            <Checkbox
              aria-label={`Select ${link.label}`}
              checked={isSelected}
              onCheckedChange={handleCheckedChange}
              className="shrink-0"
            />
          )}
        </div>

        <HugeiconsIcon
          icon={itemIcon}
          className="size-5 shrink-0 justify-self-center text-foreground"
        />

        <div className="min-w-0">
          <span className="block text-sm font-normal break-words [word-break:break-word]">
            {link.label}
          </span>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2 text-xs font-normal text-muted-foreground">
          {isFolder && hasChildren && (
            <span className="truncate">{link.children?.length} items</span>
          )}
          {!isFolder && link.size && (
            <span className="truncate">{link.size}</span>
          )}
          {isResolving ? (
            <Spinner />
          ) : canExpand ? (
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              className={cn(
                "size-3.5 shrink-0 transition-transform duration-200",
                isExpanded && "rotate-90"
              )}
            />
          ) : null}
        </div>
      </div>

      {canExpand && isExpanded && link.children && (
        <div className="ml-3 mt-1 flex min-w-0 flex-col gap-1 border-l border-border/40 pl-1.5">
          {link.children.map((child, index) => (
            <LinkSelectionTreeItem
              key={child.id || child.url + index}
              link={child}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              onExpandFolder={onExpandFolder}
            />
          ))}
        </div>
      )}
    </div>
  )
}
