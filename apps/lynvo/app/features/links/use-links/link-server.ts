import type { LinkMetadata, MetaData } from "~/features/links/types"
import { metadataSchema } from "~/features/links/storage-schemas"

export type CreateLink = (input: {
  url: string
  title: string
  metadata: unknown
}) => Promise<unknown>

export const FETCH_METADATA_TIMEOUT_MS = 20000

interface CreatedLinkRecord {
  _id?: string
  id?: string
  link?: {
    id?: string
  }
}

const isCreatedLinkRecord = (value: unknown): value is CreatedLinkRecord =>
  typeof value === "object" && value !== null

export const getCreatedLinkId = (value: unknown) => {
  if (typeof value === "string") {
    return value
  }

  if (!isCreatedLinkRecord(value)) {
    return String(value)
  }

  return value.link?.id || value._id || value.id || String(value)
}

export const fetchMetaInternal = async (
  targetUrl: string
): Promise<MetaData> => {
  try {
    const response = await fetch(
      `/api/meta?url=${encodeURIComponent(targetUrl)}`,
      {
        signal: AbortSignal.timeout?.(FETCH_METADATA_TIMEOUT_MS),
      }
    )
    if (response.ok) {
      const result = metadataSchema.safeParse(await response.json())
      return result.success ? result.data : {}
    }
  } catch (error) {
    console.warn("Unable to fetch link metadata", error)
  }
  return {}
}

export const createServerLink = async ({
  targetUrl,
  title,
  metadata,
  createLink,
}: {
  targetUrl: string
  title: string
  metadata: LinkMetadata
  createLink: CreateLink
}) => {
  const id = await createLink({
    url: targetUrl,
    title,
    metadata: structuredClone(metadata),
  })
  return getCreatedLinkId(id)
}
