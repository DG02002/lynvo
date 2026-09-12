import { useCallback, useEffect, useRef, useState } from "react"
import type { ExtractedLink, MetaData } from "~/features/links/types"
import { OPENING_RESET_DELAY_MS } from "./constants"
import type { OpenSelectionDialogOptions } from "./action-types"
import type { PluginDomainSuggestion } from "~/lib/plugin-domain"

type PendingOpeningReset = {
  listener: () => void
  timer: ReturnType<typeof setTimeout>
}

export interface SelectionDialogState {
  open: boolean
  links: ExtractedLink[]
  meta: MetaData
  originalUrl: string
  existingItemId?: string
  pluginDomainSuggestion?: PluginDomainSuggestion
}

export const useSelectionDialog = () => {
  const [selectionDialogState, setSelectionDialogState] =
    useState<SelectionDialogState>({
      open: false,
      links: [],
      meta: {},
      originalUrl: "",
    })

  const openSelectionDialog = useCallback(
    ({
      originalUrl,
      links,
      meta,
      existingItemId,
      pluginDomainSuggestion,
    }: OpenSelectionDialogOptions) => {
      setSelectionDialogState({
        open: true,
        links,
        meta,
        originalUrl,
        existingItemId,
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
  const pendingOpeningResetRef = useRef<PendingOpeningReset | undefined>(
    undefined
  )

  const clearOpeningReset = useCallback(() => {
    const pendingReset = pendingOpeningResetRef.current
    if (!pendingReset) {
      return
    }

    document.removeEventListener("visibilitychange", pendingReset.listener)
    clearTimeout(pendingReset.timer)
    pendingOpeningResetRef.current = undefined
  }, [])

  useEffect(() => {
    isOpeningRef.current = isOpening
  }, [isOpening])

  useEffect(() => clearOpeningReset, [clearOpeningReset])

  const resetOpeningWhenReady = useCallback(() => {
    clearOpeningReset()
    const reset = () => {
      setIsOpening(false)
      clearOpeningReset()
    }
    const onVisChange = () => {
      if (document.visibilityState === "visible") {
        reset()
      }
    }

    const timer = setTimeout(reset, OPENING_RESET_DELAY_MS)
    document.addEventListener("visibilitychange", onVisChange)
    pendingOpeningResetRef.current = { listener: onVisChange, timer }
  }, [clearOpeningReset])

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
