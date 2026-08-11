import type { ExtractedLink, MetaData } from "./types"
import { draftsSchema, type StoredDraft } from "./storage-schemas"
import { DRAFT_EXPIRY_TIMER_MAX_MS, DRAFT_TTL_MS } from "./constants"

const DRAFTS_KEY_PREFIX = "lynvo:drafts:v2:"
const EMPTY_DRAFTS: readonly Draft[] = []
const subscribers = new Set<() => void>()
const draftStores = new Map<string, DraftStore>()

export interface Draft extends StoredDraft {}

interface DraftStore {
  readonly key: string
  readonly subscribers: Set<() => void>
  cachedStorageValue: string | null | undefined
  cachedDrafts: readonly Draft[]
  cachedStorage: Storage | undefined
  expiryTimer: number | undefined
}

const getDraftStore = (userId: string): DraftStore => {
  const existingStore = draftStores.get(userId)
  if (existingStore) {
    return existingStore
  }
  const store: DraftStore = {
    key: `${DRAFTS_KEY_PREFIX}${userId}`,
    subscribers: new Set(),
    cachedStorageValue: undefined,
    cachedDrafts: EMPTY_DRAFTS,
    cachedStorage: undefined,
    expiryTimer: undefined,
  }
  draftStores.set(userId, store)
  return store
}

const encodeUrlForKey = (url: string): string => btoa(encodeURIComponent(url))

const readStorageValue = (store: DraftStore): string | null => {
  try {
    return localStorage.getItem(store.key)
  } catch {
    return null
  }
}

const parseDrafts = (
  store: DraftStore,
  storageValue: string | null
): Record<string, Draft> => {
  if (!storageValue) {
    return {}
  }
  try {
    const parsed: unknown = JSON.parse(storageValue)
    const result = draftsSchema.safeParse(parsed)
    if (result.success) {
      return result.data
    }
    localStorage.removeItem(store.key)
  } catch {}
  return {}
}

const clearExpiryTimer = (store: DraftStore) => {
  if (store.expiryTimer !== undefined) {
    window.clearTimeout(store.expiryTimer)
    store.expiryTimer = undefined
  }
}

const scheduleNextExpiry = (store: DraftStore) => {
  clearExpiryTimer(store)
  if (store.subscribers.size === 0) {
    return
  }
  const nextExpiryMs = getDraftsSnapshotForStore(store).reduce(
    (nearestExpiryMs, draft) => Math.min(nearestExpiryMs, draft.expiresAt),
    Number.POSITIVE_INFINITY
  )
  if (!Number.isFinite(nextExpiryMs)) {
    return
  }
  store.expiryTimer = window.setTimeout(
    () => publish(store),
    Math.min(Math.max(nextExpiryMs - Date.now(), 0), DRAFT_EXPIRY_TIMER_MAX_MS)
  )
}

const publish = (store: DraftStore) => {
  store.cachedStorageValue = undefined
  for (const subscriber of store.subscribers) {
    subscriber()
  }
  scheduleNextExpiry(store)
}

const writeRawDrafts = (store: DraftStore, drafts: Record<string, Draft>) => {
  try {
    localStorage.setItem(store.key, JSON.stringify(drafts))
    publish(store)
  } catch {}
}

const getCurrentDraftRecord = (store: DraftStore) =>
  parseDrafts(store, readStorageValue(store))

export const readDraft = (userId: string, url: string): Draft | null => {
  const store = getDraftStore(userId)
  const drafts = getCurrentDraftRecord(store)
  const key = encodeUrlForKey(url)
  const draft = drafts[key]
  if (!draft) {
    return null
  }
  if (draft.expiresAt <= Date.now()) {
    delete drafts[key]
    writeRawDrafts(store, drafts)
    return null
  }
  return draft
}

export const writeDraft = (
  userId: string,
  url: string,
  links: ExtractedLink[],
  meta: MetaData
) => {
  const store = getDraftStore(userId)
  const currentTimeMs = Date.now()
  const drafts = Object.fromEntries(
    Object.entries(getCurrentDraftRecord(store)).filter(
      ([, draft]) => draft.expiresAt > currentTimeMs
    )
  )
  drafts[encodeUrlForKey(url)] = {
    links,
    meta,
    originalUrl: url,
    expiresAt: currentTimeMs + DRAFT_TTL_MS,
  }
  writeRawDrafts(store, drafts)
}

export const deleteDraft = (userId: string, url: string) => {
  const store = getDraftStore(userId)
  const drafts = getCurrentDraftRecord(store)
  const key = encodeUrlForKey(url)
  if (!drafts[key]) {
    return
  }
  delete drafts[key]
  writeRawDrafts(store, drafts)
}

const getDraftsSnapshotForStore = (store: DraftStore): readonly Draft[] => {
  if (
    store.cachedStorage === localStorage &&
    store.cachedStorageValue !== undefined
  ) {
    return store.cachedDrafts
  }
  const storageValue = readStorageValue(store)
  store.cachedStorage = localStorage
  store.cachedStorageValue = storageValue
  const currentTimeMs = Date.now()
  store.cachedDrafts = Object.values(parseDrafts(store, storageValue)).filter(
    (draft) => draft.expiresAt > currentTimeMs
  )
  return store.cachedDrafts
}

export const getDraftsSnapshot = (userId: string) =>
  getDraftsSnapshotForStore(getDraftStore(userId))

export const getServerDraftsSnapshot = (): readonly Draft[] => EMPTY_DRAFTS

export const subscribeToDrafts = (userId: string, subscriber: () => void) => {
  const store = getDraftStore(userId)
  store.subscribers.add(subscriber)
  const handleStorage = (event: StorageEvent) => {
    if (event.key === store.key || event.key === null) {
      publish(store)
    }
  }
  window.addEventListener("storage", handleStorage)
  scheduleNextExpiry(store)
  return () => {
    store.subscribers.delete(subscriber)
    window.removeEventListener("storage", handleStorage)
    if (store.subscribers.size === 0) {
      clearExpiryTimer(store)
    }
  }
}
