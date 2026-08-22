import type { LinkMetadata, MetaData } from "~/features/links/types"
import { metadataSchema } from "~/features/links/storage-schemas"
import { Result, Schema } from "effect"

const createdLinkRecordSchema = Schema.Struct({
  _id: Schema.optional(Schema.String),
  id: Schema.optional(Schema.String),
  link: Schema.optional(Schema.Struct({ id: Schema.optional(Schema.String) })),
})

export type CreateLink = (input: {
  url: string
  title: string
  metadata: unknown
}) => Promise<string | typeof createdLinkRecordSchema.Type>

export const FETCH_METADATA_TIMEOUT_MS = 20000

export const getCreatedLinkId = <Value>(value: Value) => {
  const stringResult = Schema.decodeUnknownResult(Schema.String)(value)
  if (Result.isSuccess(stringResult)) {
    return stringResult.success
  }

  const record = Schema.decodeUnknownResult(createdLinkRecordSchema)(value)
  if (Result.isFailure(record)) {
    return String(value)
  }

  return (
    record.success.link?.id ||
    record.success._id ||
    record.success.id ||
    String(value)
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
      const result = Schema.decodeUnknownResult(metadataSchema)(
        await response.json()
      )
      return Result.isSuccess(result) ? result.success : {}
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
