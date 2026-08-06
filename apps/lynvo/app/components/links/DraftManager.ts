import { useEffect } from "react"
import type { ExtractedLink, MetaData } from "~/features/links/types"
import {
  draftsSchema,
  type StoredDraft,
} from "~/features/links/storage-schemas"

const DRAFTS_KEY = "lynvo:drafts:v1"
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface Draft extends StoredDraft {}

function encodeUrlForKey(url: string): string {
  return btoa(encodeURIComponent(url))
}

function readRawDrafts(): Record<string, Draft> | null {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY)
    if (!raw) {
      return null
    }
    const parsed: unknown = JSON.parse(raw)
    const result = draftsSchema.safeParse(parsed)
    if (!result.success) {
      localStorage.removeItem(DRAFTS_KEY)
      return null
    }
    return result.data
  } catch {
    return null
  }
}

function notifyDraftsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("lynvo:drafts:change"))
  }
}

function writeRawDrafts(drafts: Record<string, Draft>) {
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts))
    notifyDraftsChanged()
  } catch {}
}

function sweepExpired(raw: Record<string, Draft>): Record<string, Draft> {
  const now = Date.now()
  let changed = false
  for (const key of Object.keys(raw)) {
    if (raw[key].expiresAt < now) {
      delete raw[key]
      changed = true
    }
  }
  return changed ? { ...raw } : raw
}

export function readDraft(url: string): Draft | null {
  const raw = readRawDrafts()
  if (!raw) {
    return null
  }
  const key = encodeUrlForKey(url)
  const draft = raw[key]
  if (!draft) {
    return null
  }
  if (draft.expiresAt < Date.now()) {
    delete raw[key]
    writeRawDrafts(raw)
    return null
  }
  return draft
}

export function writeDraft(
  url: string,
  links: ExtractedLink[],
  meta: MetaData
) {
  const raw = sweepExpired(readRawDrafts() ?? {})
  raw[encodeUrlForKey(url)] = {
    links,
    meta,
    originalUrl: url,
    expiresAt: Date.now() + DRAFT_TTL_MS,
  }
  writeRawDrafts(raw)
}

export function deleteDraft(url: string) {
  const raw = readRawDrafts()
  if (!raw) {
    return
  }
  const key = encodeUrlForKey(url)
  if (raw[key]) {
    delete raw[key]
    writeRawDrafts(raw)
  }
}

export function getExpiringDrafts(): Draft[] {
  const raw = sweepExpired(readRawDrafts() ?? {})
  return Object.values(raw).filter((d) => d.expiresAt > Date.now())
}

export function useDraftSweep() {
  useEffect(() => {
    const raw = readRawDrafts()
    if (raw) {
      const cleaned = sweepExpired(raw)
      if (Object.keys(cleaned).length !== Object.keys(raw).length) {
        writeRawDrafts(cleaned)
      }
    }
  }, [])
}
