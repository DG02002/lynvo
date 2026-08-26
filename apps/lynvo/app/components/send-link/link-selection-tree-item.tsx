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
import { Spinner } from "~/components/spinner"
import { FilenameText } from "~/components/filename-text"
import type { ExtractedLink } from "~/features/links/types"
import {
  getMediaNodeKey,
  getMediaNodeTargetOrUndefined,
} from "~/features/links/media-node-interaction"
import { cn } from "~/lib/utils"
import { formatItemCount } from "~/lib/format-item-count"
import { getLinkSelectionState } from "./link-selection-state"
import { getMediaNodeInteractionState } from "~/features/links/media-node-interaction"

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
    getMediaNodeInteractionState(link).needsResolution &&
    Boolean(onExpandFolder)
  const folderState = !isFolder
    ? undefined
    : isExpanded
      ? "open"
      : getMediaNodeInteractionState(link).needsResolution
        ? "lazy-closed"
        : "closed"
  const itemIcon = isFolder
    ? folderState === "open"
      ? Folder02Icon
      : folderState === "lazy-closed"
        ? FolderSymlinkIcon
        : Folder01Icon
    : Video02Icon
  const hasTrailingContent = Boolean(
    (isFolder && hasChildren) || (!isFolder && link.size) || canExpand
  )

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
      setIsExpanded((currentValue) => !currentValue)
      return
    }
    if (!canResolve || isResolving || !onExpandFolder) {
      return
    }

    const linkTarget = getMediaNodeTargetOrUndefined(link)
    if (linkTarget === undefined) {
      return
    }

    setIsResolving(true)
    const didResolve = await onExpandFolder(linkId, linkTarget)
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
          "grid min-w-0 items-center gap-x-3 rounded-lg p-2 text-foreground transition-colors",
          hasTrailingContent
            ? "grid-cols-[1.25rem_1.5rem_minmax(0,1fr)_4rem]"
            : "grid-cols-[1.25rem_1.5rem_minmax(0,1fr)]",
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

        {isResolving ? (
          <Spinner
            aria-label={`Loading ${link.label}…`}
            className="size-5 shrink-0 justify-self-center"
          />
        ) : (
          <HugeiconsIcon
            icon={itemIcon}
            className="size-5 shrink-0 justify-self-center text-foreground"
          />
        )}

        <div className="min-w-0">
          <FilenameText
            value={link.label}
            className="block text-sm font-normal"
          />
        </div>

        {hasTrailingContent && (
          <div className="flex min-w-0 items-center justify-end gap-2 text-xs font-normal text-muted-foreground">
            {isFolder && hasChildren && (
              <span className="truncate">
                {formatItemCount(link.children?.length ?? 0)}
              </span>
            )}
            {!isFolder && link.size && (
              <span className="truncate">{link.size}</span>
            )}
            {canExpand ? (
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                className={cn(
                  "size-3.5 shrink-0 transition-transform duration-200",
                  isExpanded && "rotate-90"
                )}
              />
            ) : null}
          </div>
        )}
      </div>

      {canExpand && isExpanded && link.children && (
        <div className="ml-3 mt-1 flex min-w-0 flex-col gap-1 border-l border-border/40 pl-1.5">
          {link.children.map((child) => (
            <LinkSelectionTreeItem
              key={getMediaNodeKey(child)}
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
