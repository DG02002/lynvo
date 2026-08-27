import * as React from "react"
import { Dialog, DialogClose, DialogContent } from "~/components/ui/dialog"
import { DialogActionButton } from "~/components/dialog-action-button"
import { Checkbox } from "~/components/ui/checkbox"
import type { ExtractedLink } from "~/features/links/types"
import { getMediaNodeKey } from "~/features/links/media-node-interaction"
import { LinkSelectionHeader } from "./link-selection-header"
import { LinkSelectionTree } from "./link-selection-tree"
import {
  collectLinkAndDescendantIds,
  collectSelectableLinkIds,
  collectSelectedLinks,
  isAllChildrenSelected,
} from "./link-selection-utils"

const EMPTY_PRE_SELECTED_IDS: string[] = []

interface LinkSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  links: ExtractedLink[]
  onConfirm: (selectedLinks: ExtractedLink[]) => void
  onExpandFolder?: (
    linkId: string,
    linkUrl: string
  ) => Promise<ExtractedLink[] | null>
  onClose?: (selectedIds: string[]) => void
  pluginIcon?: string
  pluginName?: string
  pageTitle?: string
  audioInfo?: string
  preSelectedIds?: string[]
}

export function LinkSelectionDialog({
  open,
  onOpenChange,
  links,
  onConfirm,
  onExpandFolder,
  onClose,
  pluginIcon,
  pluginName,
  pageTitle,
  audioInfo,
  preSelectedIds = EMPTY_PRE_SELECTED_IDS,
}: LinkSelectionDialogProps) {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    () => new Set(preSelectedIds)
  )
  const selectableIds = React.useMemo(
    () => collectSelectableLinkIds(links),
    [links]
  )
  const isAllSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id))
  const selectedCount = selectableIds.filter((id) => selectedIds.has(id)).length

  const [prevOpen, setPrevOpen] = React.useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setSelectedIds(new Set(preSelectedIds))
    }
  }

  const handleToggleSelect = React.useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)

        const findLink = (
          items: ExtractedLink[],
          targetId: string
        ): ExtractedLink | undefined => {
          for (const item of items) {
            const itemId = item.id || item.url
            if (itemId === targetId) {
              return item
            }
            if (item.children) {
              const found = findLink(item.children, targetId)
              if (found) {
                return found
              }
            }
          }
          return undefined
        }

        const targetLink = findLink(links, id)
        if (!targetLink) {
          if (next.has(id)) {
            next.delete(id)
          } else {
            next.add(id)
          }
          return next
        }

        const descendantIds = collectLinkAndDescendantIds(targetLink)
        const isSelecting = !isAllChildrenSelected(targetLink, prev)

        if (isSelecting) {
          descendantIds.forEach((dId) => next.add(dId))
        } else {
          descendantIds.forEach((dId) => next.delete(dId))

          const deselectParents = (
            items: ExtractedLink[],
            targetId: string
          ): boolean => {
            for (const item of items) {
              const itemId = getMediaNodeKey(item)
              if (itemId === targetId) {
                return true
              }
              if (item.children) {
                const containsTarget = deselectParents(item.children, targetId)
                if (containsTarget) {
                  next.delete(itemId)
                  return true
                }
              }
            }
            return false
          }
          deselectParents(links, id)
        }

        return next
      })
    },
    [links]
  )

  const handleConfirm = () => {
    onConfirm(collectSelectedLinks(links, selectedIds))
    onOpenChange(false)
  }

  const handleToggleSelectAll = () => {
    setSelectedIds((currentSelectedIds) => {
      if (selectableIds.every((id) => currentSelectedIds.has(id))) {
        return new Set()
      }
      return new Set(selectableIds)
    })
  }

  const handleExpandFolder = React.useCallback(
    async (linkId: string, linkUrl: string) => {
      if (!onExpandFolder) {
        return false
      }
      const resolvedChildren = await onExpandFolder(linkId, linkUrl)
      if (resolvedChildren === null) {
        return false
      }

      setSelectedIds((currentSelectedIds) => {
        if (!currentSelectedIds.has(linkId)) {
          return currentSelectedIds
        }
        const nextSelectedIds = new Set(currentSelectedIds)
        for (const child of resolvedChildren) {
          for (const descendantId of collectLinkAndDescendantIds(child)) {
            nextSelectedIds.add(descendantId)
          }
        }
        return nextSelectedIds
      })
      return true
    },
    [onExpandFolder]
  )

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onClose?.([...selectedIds])
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-svh max-h-none w-screen min-w-0 max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[85vh] sm:w-[calc(100vw-2rem)] sm:rounded-4xl md:w-[calc(100vw-4rem)] md:max-w-[60rem]"
      >
        <LinkSelectionHeader
          pluginIcon={pluginIcon}
          pluginName={pluginName}
          pageTitle={pageTitle}
          audioInfo={audioInfo}
        />

        <div className="min-w-0 flex-1 overflow-y-auto bg-popover px-4 py-4 md:px-8 md:py-6">
          <LinkSelectionTree
            links={links}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onExpandFolder={onExpandFolder ? handleExpandFolder : undefined}
          />
        </div>

        <div className="z-10 flex flex-col gap-3 border-t bg-popover px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-6">
          {selectableIds.length > 0 && (
            <div className="flex min-h-11 w-full items-center justify-between gap-3 sm:w-auto sm:justify-start">
              <label
                className="grid cursor-pointer grid-cols-[1.25rem_auto] items-center gap-x-3 rounded-lg pl-2 focus-within:ring-2 focus-within:ring-ring"
                onClick={(event) => {
                  if (
                    event.target instanceof Element &&
                    event.target.closest('[data-slot="checkbox"]')
                  ) {
                    return
                  }
                  event.preventDefault()
                  handleToggleSelectAll()
                }}
              >
                <span className="flex size-5 items-center justify-center">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleToggleSelectAll}
                  />
                </span>
                <span className="text-sm font-medium">Select all</span>
              </label>
              <span className="text-sm tabular-nums text-muted-foreground">
                {selectedCount} selected
              </span>
            </div>
          )}
          <div className="flex w-full flex-row gap-3 sm:ml-auto sm:w-auto">
            <DialogClose
              render={
                <DialogActionButton
                  variant="secondary"
                  className="w-auto min-w-0 flex-1 shrink sm:flex-none"
                />
              }
            >
              Cancel
            </DialogClose>
            <DialogActionButton
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              className="w-auto min-w-0 flex-1 shrink sm:flex-none"
            >
              Save
            </DialogActionButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
