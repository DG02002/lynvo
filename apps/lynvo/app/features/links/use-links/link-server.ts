import { Result, Schema } from "effect"

import { metadataSchema } from "~/features/links/storage-schemas"
import type { MetaData } from "~/features/links/types"
import { requestSameOrigin } from "~/lib/api/client"

const FETCH_METADATA_TIMEOUT_MS = 20000

export const fetchMetaInternal = async (
  targetUrl: string
): Promise<MetaData> => {
  try {
    const response = await requestSameOrigin("/api/meta", {
      includeSessionIdentityHeaders: false,
      query: { url: targetUrl },
      timeoutMs: FETCH_METADATA_TIMEOUT_MS,
    })
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
