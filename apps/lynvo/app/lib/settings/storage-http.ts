const sameOriginJson = async (input: string, init?: RequestInit) => {
  const response = await fetch(input, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }
  return response
}

export interface StorageSettingsSnapshot {
  enforcedBytes: number
  linkBytes: number
  pluginServerBytes: number
  pluginDomainBytes: number
  profileBytes: number
  savedLinkCount: number
  averageLinkBytes: number
  storageLimitBytes: number
  storageWarningBytes: number
  linkLimitBytes: number
  retentionDays: number
  retentionDayOptions: number[]
  defaultRetentionDays: number
  maxRetentionDays: number
}

export const readStorageSettings = async (): Promise<StorageSettingsSnapshot> =>
  await sameOriginJson("/api/data/storage-settings").then((response) =>
    response.json()
  )

export const previewStorageRetention = async (
  days: number
): Promise<{ expiredLinkCount: number }> =>
  await sameOriginJson(
    `/api/data/storage-settings/retention-preview?days=${encodeURIComponent(String(days))}`
  ).then((response) => response.json())

export interface UpdateRetentionResult {
  success: boolean
  deletedLinks: number
  dataVersion: number
}

export const updateStorageRetention = async (input: {
  days: number
  deleteExpiredLinks: boolean
}): Promise<UpdateRetentionResult> =>
  await sameOriginJson("/api/data/storage-settings", {
    method: "PATCH",
    body: JSON.stringify(input),
  }).then((response) => response.json())

export interface ClearLinksResult {
  success: boolean
  deletedLinks: number
  dataVersion: number
}

export const clearSavedLinksOverHttp = async (): Promise<ClearLinksResult> =>
  await sameOriginJson("/api/data/links/clear", {
    method: "POST",
    body: JSON.stringify({}),
  }).then((response) => response.json())

export interface LynvoUsageSnapshot {
  metrics: Array<{
    id: string
    label: string
    used: number
    limit: number
    unit: string
    period: "daily" | "monthly"
    resetsAt: string
    pluginId?: string
  }>
}

export const readLynvoUsage = async (): Promise<LynvoUsageSnapshot> =>
  await sameOriginJson("/api/data/usage").then((response) => response.json())
