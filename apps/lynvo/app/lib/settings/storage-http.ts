import {
  ClearLinksResponseSchema,
  LynvoUsageSnapshotSchema,
  RetentionPreviewResponseSchema,
  StorageSettingsSnapshotSchema,
  UpdateRetentionResponseSchema,
  type ClearLinksResponse,
  type LynvoUsageSnapshot,
  type StorageSettingsSnapshot,
  type UpdateRetentionResponse,
} from "../api-contracts"
import { requestJson } from "../api/client"

export const readStorageSettings = async (): Promise<StorageSettingsSnapshot> =>
  await requestJson(
    "/api/data/storage-settings",
    {},
    StorageSettingsSnapshotSchema
  )

export const previewStorageRetention = async (
  days: number
): Promise<{ readonly expiredLinkCount: number }> =>
  await requestJson(
    `/api/data/storage-settings/retention-preview?days=${encodeURIComponent(String(days))}`,
    {},
    RetentionPreviewResponseSchema
  )

export const updateStorageRetention = async (input: {
  days: number
  deleteExpiredLinks: boolean
}): Promise<UpdateRetentionResponse> =>
  await requestJson(
    "/api/data/storage-settings",
    { method: "PATCH", payload: input },
    UpdateRetentionResponseSchema
  )

export const clearSavedLinksOverHttp = async (): Promise<ClearLinksResponse> =>
  await requestJson(
    "/api/data/links/clear",
    { method: "POST", payload: { operationId: crypto.randomUUID() } },
    ClearLinksResponseSchema
  )

export const readLynvoUsage = async (): Promise<LynvoUsageSnapshot> =>
  await requestJson("/api/data/usage", {}, LynvoUsageSnapshotSchema)
