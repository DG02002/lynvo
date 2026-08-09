import type { ExtractedLink, MetaData } from "./types"
import { draftsSchema, type StoredDraft } from "./storage-schemas"
import { DRAFT_EXPIRY_TIMER_MAX_MS, DRAFT_TTL_MS } from "./constants"

const DRAFTS_KEY = "lynvo:drafts:v1"
const EMPTY_DRAFTS: readonly Draft[] = []
const subscribers = new Set<() => void>()
let cachedStorageValue: string | null | undefined
let cachedDrafts: readonly Draft[] = EMPTY_DRAFTS
let cachedStorage: Storage | undefined
let expiryTimer: number | undefined
let publish = () => undefined

export interface Draft extends StoredDraft {}

const encodeUrlForKey = (url: string): string => btoa(encodeURIComponent(url))

const readStorageValue = (): string | null => {
  try {
    return localStorage.getItem(DRAFTS_KEY)
  } catch {
    return null
  }
}

const parseDrafts = (storageValue: string | null): Record<string, Draft> => {
  if (!storageValue) {
    return {}
  }
  try {
    const parsed: unknown = JSON.parse(storageValue)
    const result = draftsSchema.safeParse(parsed)
    if (result.success) {
      return result.data
    }
    localStorage.removeItem(DRAFTS_KEY)
  } catch {}
  return {}
}

const clearExpiryTimer = () => {
  if (expiryTimer !== undefined) {
    window.clearTimeout(expiryTimer)
    expiryTimer = undefined
  }
}

const scheduleNextExpiry = () => {
  clearExpiryTimer()
  if (subscribers.size === 0) {
    return
  }
  const nextExpiryMs = getDraftsSnapshot().reduce(
    (nearestExpiryMs, draft) => Math.min(nearestExpiryMs, draft.expiresAt),
    Number.POSITIVE_INFINITY
  )
  if (!Number.isFinite(nextExpiryMs)) {
    return
  }
  expiryTimer = window.setTimeout(
    publish,
    Math.min(Math.max(nextExpiryMs - Date.now(), 0), DRAFT_EXPIRY_TIMER_MAX_MS)
  )
}

publish = () => {
  cachedStorageValue = undefined
  for (const subscriber of subscribers) {
    subscriber()
  }
  scheduleNextExpiry()
}

const writeRawDrafts = (drafts: Record<string, Draft>) => {
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts))
    publish()
  } catch {}
}

const getCurrentDraftRecord = () => parseDrafts(readStorageValue())

export const readDraft = (url: string): Draft | null => {
  const drafts = getCurrentDraftRecord()
  const key = encodeUrlForKey(url)
  const draft = drafts[key]
  if (!draft) {
    return null
  }
  if (draft.expiresAt <= Date.now()) {
    delete drafts[key]
    writeRawDrafts(drafts)
    return null
  }
  return draft
}

export const writeDraft = (
  url: string,
  links: ExtractedLink[],
  meta: MetaData
) => {
  const currentTimeMs = Date.now()
  const drafts = Object.fromEntries(
    Object.entries(getCurrentDraftRecord()).filter(
      ([, draft]) => draft.expiresAt > currentTimeMs
    )
  )
  drafts[encodeUrlForKey(url)] = {
    links,
    meta,
    originalUrl: url,
    expiresAt: currentTimeMs + DRAFT_TTL_MS,
  }
  writeRawDrafts(drafts)
}

export const deleteDraft = (url: string) => {
  const drafts = getCurrentDraftRecord()
  const key = encodeUrlForKey(url)
  if (!drafts[key]) {
    return
  }
  delete drafts[key]
  writeRawDrafts(drafts)
}

export const getDraftsSnapshot = (): readonly Draft[] => {
  if (cachedStorage === localStorage && cachedStorageValue !== undefined) {
    return cachedDrafts
  }
  const storageValue = readStorageValue()
  cachedStorage = localStorage
  cachedStorageValue = storageValue
  const currentTimeMs = Date.now()
  cachedDrafts = Object.values(parseDrafts(storageValue)).filter(
    (draft) => draft.expiresAt > currentTimeMs
  )
  return cachedDrafts
}

export const getServerDraftsSnapshot = (): readonly Draft[] => EMPTY_DRAFTS

export const subscribeToDrafts = (subscriber: () => void) => {
  subscribers.add(subscriber)
  const handleStorage = (event: StorageEvent) => {
    if (event.key === DRAFTS_KEY || event.key === null) {
      publish()
    }
  }
  window.addEventListener("storage", handleStorage)
  scheduleNextExpiry()
  return () => {
    subscribers.delete(subscriber)
    window.removeEventListener("storage", handleStorage)
    if (subscribers.size === 0) {
      clearExpiryTimer()
    }
  }
}
