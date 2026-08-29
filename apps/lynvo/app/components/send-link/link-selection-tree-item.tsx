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
  getMediaNodeInteractionState,
} from "~/features/links/media-node-interaction"
import { cn } from "~/lib/utils"
import { formatItemCount } from "~/lib/format-item-count"
import { getLinkSelectionState } from "./link-selection-state"

interface LinkSelectionTreeItemProps {
  link: ExtractedLink
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onExpandFolder?: (linkId: string, linkUrl: string) => Promise<boolean>
}

const getLinkSelectionFolderState = (
  isFolder: boolean,
  isExpanded: boolean,
  needsResolution: boolean
) => {
  if (!isFolder) {
    return undefined
  }

  if (isExpanded) {
    return "open"
  }

  if (needsResolution) {
    return "lazy-closed"
  }

  return "closed"
}

const getLinkSelectionItemIcon = (
  isFolder: boolean,
  folderState: ReturnType<typeof getLinkSelectionFolderState>
) => {
  if (!isFolder) {
    return Video02Icon
  }

  if (folderState === "open") {
    return Folder02Icon
  }

  if (folderState === "lazy-closed") {
    return FolderSymlinkIcon
  }

  return Folder01Icon
}

interface LinkSelectionVisualState {
  readonly canResolve: boolean
  readonly folderState: ReturnType<typeof getLinkSelectionFolderState>
  readonly itemIcon: ReturnType<typeof getLinkSelectionItemIcon>
  readonly hasTrailingContent: boolean
}

interface LinkSelectionVisualStateOptions {
  readonly link: ExtractedLink
  readonly isFolder: boolean
  readonly hasChildren: boolean
  readonly canExpand: boolean
  readonly isExpanded: boolean
  readonly onExpandFolder: LinkSelectionTreeItemProps["onExpandFolder"]
}

const getLinkSelectionVisualState = ({
  link,
  isFolder,
  hasChildren,
  canExpand,
  isExpanded,
  onExpandFolder,
}: LinkSelectionVisualStateOptions): LinkSelectionVisualState => {
  const interactionState = getMediaNodeInteractionState(link)
  const canResolve = interactionState.needsResolution && Boolean(onExpandFolder)
  const folderState = getLinkSelectionFolderState(
    isFolder,
    isExpanded,
    interactionState.needsResolution
  )
  const itemIcon = getLinkSelectionItemIcon(isFolder, folderState)
  const hasTrailingContent = Boolean(
    (isFolder && hasChildren) || (!isFolder && link.size) || canExpand
  )

  return { canResolve, folderState, itemIcon, hasTrailingContent }
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
    isSelectionControlAvailable,
    hasChildren,
    canExpand,
    isSelected,
  } = getLinkSelectionState(link, selectedIds)
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [isResolving, setIsResolving] = React.useState(false)
  const { canResolve, folderState, itemIcon, hasTrailingContent } =
    getLinkSelectionVisualState({
      link,
      isFolder,
      hasChildren,
      canExpand,
      isExpanded,
      onExpandFolder,
    })

  const handleRowAction = async () => {
    if (canExpand) {
      setIsExpanded((currentValue) => !currentValue)
      return
    }
    if (canResolve && !isResolving && onExpandFolder) {
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
      return
    }
    if (isSelectionControlAvailable) {
      onToggleSelect(linkId)
    }
  }

  const handleCheckedChange = () => {
    if (isSelectionControlAvailable) {
      onToggleSelect(linkId)
    }
  }

  return (
    <div className="flex min-w-0 select-none flex-col">
      <div
        role="treeitem"
        aria-expanded={canExpand || canResolve ? isExpanded : undefined}
        aria-selected={isSelectionControlAvailable ? isSelected : undefined}
        data-folder-state={folderState}
        tabIndex={0}
        className={cn(
          "grid min-w-0 items-center gap-x-3 rounded-lg p-2 text-foreground transition-colors",
          isSelectionControlAvailable &&
            (hasTrailingContent
              ? "grid-cols-[1.25rem_1.5rem_minmax(0,1fr)_4rem]"
              : "grid-cols-[1.25rem_1.5rem_minmax(0,1fr)]"),
          !isSelectionControlAvailable &&
            (hasTrailingContent
              ? "grid-cols-[1.5rem_minmax(0,1fr)_4rem]"
              : "grid-cols-[1.5rem_minmax(0,1fr)]"),
          (canExpand || canResolve || isSelectionControlAvailable) &&
            "hover:bg-muted/50 cursor-pointer",
          !canExpand &&
            !canResolve &&
            !isSelectionControlAvailable &&
            "cursor-default",
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
        {isSelectionControlAvailable && (
          <div
            className="flex size-5 items-center justify-center"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <Checkbox
              aria-label={`Select ${link.label}`}
              checked={isSelected}
              onCheckedChange={handleCheckedChange}
              className="shrink-0"
            />
          </div>
        )}

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
