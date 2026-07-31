import { useCallback, useEffect, useRef, useState } from "react"
import type { ExtractedLink, MetaData } from "~/features/links/types"
import { OPENING_RESET_DELAY_MS } from "./constants"
import type { OpenSelectionDialogOptions } from "./action-types"
import type { SourceDomainSuggestion } from "~/lib/plugin-domain"

export interface SelectionDialogState {
  open: boolean
  links: ExtractedLink[]
  meta: MetaData
  originalUrl: string
  existingItemId?: string
  isDraftMode: boolean
  pluginDomainSuggestion?: SourceDomainSuggestion
}

export const useSelectionDialog = () => {
  const [selectionDialogState, setSelectionDialogState] =
    useState<SelectionDialogState>({
      open: false,
      links: [],
      meta: {},
      originalUrl: "",
      isDraftMode: false,
    })

  const openSelectionDialog = useCallback(
    ({
      originalUrl,
      links,
      meta,
      existingItemId,
      isDraftMode = false,
      pluginDomainSuggestion,
    }: OpenSelectionDialogOptions) => {
      setSelectionDialogState({
        open: true,
        links,
        meta,
        originalUrl,
        existingItemId,
        isDraftMode,
        pluginDomainSuggestion,
      })
    },
    []
  )

  const closeSelectionDialog = useCallback(
    () =>
      setSelectionDialogState((prev) => ({
        ...prev,
        open: false,
        pluginDomainSuggestion: undefined,
      })),
    []
  )

  return {
    selectionDialogState,
    setSelectionDialogState,
    openSelectionDialog,
    closeSelectionDialog,
  }
}

export const useOpeningState = () => {
  const [isOpening, setIsOpening] = useState(false)
  const isOpeningRef = useRef(isOpening)

  useEffect(() => {
    isOpeningRef.current = isOpening
  }, [isOpening])

  const resetOpeningWhenReady = useCallback(() => {
    const reset = () => setIsOpening(false)
    const onVisChange = () => {
      if (document.visibilityState === "visible") {
        reset()
        document.removeEventListener("visibilitychange", onVisChange)
      }
    }

    document.addEventListener("visibilitychange", onVisChange)
    setTimeout(reset, OPENING_RESET_DELAY_MS)
  }, [])

  return { isOpening, setIsOpening, isOpeningRef, resetOpeningWhenReady }
}

export const useExtractingItems = () => {
  const [extractingItems, setExtractingItems] = useState<Set<string>>(new Set())

  const addExtractingItem = useCallback((itemKey: string) => {
    setExtractingItems((prev) => new Set(prev).add(itemKey))
  }, [])

  const removeExtractingItem = useCallback((itemKey: string) => {
    setExtractingItems((prev) => {
      const next = new Set(prev)
      next.delete(itemKey)
      return next
    })
  }, [])

  const runWithExtractingItem = useCallback(
    async <T>(itemKey: string, task: () => Promise<T>) => {
      addExtractingItem(itemKey)
      try {
        return await task()
      } finally {
        removeExtractingItem(itemKey)
      }
    },
    [addExtractingItem, removeExtractingItem]
  )

  return {
    extractingItems,
    addExtractingItem,
    removeExtractingItem,
    runWithExtractingItem,
  }
}
