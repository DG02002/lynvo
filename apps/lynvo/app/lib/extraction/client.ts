import { Effect } from "effect"
import { client } from "~/lib/effect/api/client"
import { resolveMetadataIconUrls } from "./metadata-icon-urls"
import {
  extractedLinkSchema,
  metadataSchema,
} from "~/features/links/storage-schemas"
import { z } from "zod"
import type { MetaData } from "~/features/links/types"

const extractionResultSchema = z.object({
  links: z.array(extractedLinkSchema),
  meta: metadataSchema.optional(),
})

const resolveClientMetadataIconUrls = (metadata: MetaData) =>
  globalThis.window === undefined
    ? metadata
    : resolveMetadataIconUrls(metadata, window.location.href)

export const defaultExtractionClient: ExtractionTransport = {
  extract: async (query) => {
    const result = extractionResultSchema.parse(
      await Effect.runPromise(client.extraction.extract({ query }))
    )
    return result.meta
      ? { ...result, meta: resolveClientMetadataIconUrls(result.meta) }
      : result
  },
  getMetadata: async (query) => {
    const metadata = metadataSchema.parse(
      await Effect.runPromise(client.extraction.getMetadata({ query }))
    )
    return resolveClientMetadataIconUrls(metadata)
  },
}
