import type { LinkMetadata, MetaData } from "~/features/links/types"
import { metadataSchema } from "~/features/links/storage-schemas"
import { z } from "zod"

export type CreateLink = (input: {
  url: string
  title: string
  metadata: unknown
}) => Promise<string | z.infer<typeof createdLinkRecordSchema>>

export const FETCH_METADATA_TIMEOUT_MS = 20000

const createdLinkRecordSchema = z.object({
  _id: z.string().optional(),
  id: z.string().optional(),
  link: z.object({ id: z.string().optional() }).optional(),
})

export const getCreatedLinkId = <Value>(value: Value) => {
  const stringValue = z.string().safeParse(value)
  if (stringValue.success) {
    return stringValue.data
  }

  const record = createdLinkRecordSchema.safeParse(value)
  if (!record.success) {
    return String(value)
  }

  return (
    record.data.link?.id || record.data._id || record.data.id || String(value)
  )
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
