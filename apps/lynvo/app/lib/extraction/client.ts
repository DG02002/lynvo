import { Effect, Schema } from "effect"
import { client } from "~/lib/effect/api/client"
import { resolveMetadataIconUrls } from "./metadata-icon-urls"
import {
  extractedLinkSchema,
  metadataSchema,
} from "~/features/links/storage-schemas"
import type { MetaData } from "~/features/links/types"

const extractionResultSchema = Schema.Struct({
  links: Schema.Array(extractedLinkSchema),
  meta: Schema.optional(metadataSchema),
})

const resolveClientMetadataIconUrls = (metadata: MetaData) =>
  globalThis.window === undefined
    ? metadata
    : resolveMetadataIconUrls(metadata, window.location.href)

export const defaultExtractionClient: ExtractionTransport = {
  extract: async (query) => {
    const result = Schema.decodeUnknownSync(extractionResultSchema)(
      await Effect.runPromise(client.extraction.extract({ query }))
    )
    const links = [...result.links]
    return result.meta
      ? { links, meta: resolveClientMetadataIconUrls(result.meta) }
      : { links }
  },
  getMetadata: async (query) => {
    const metadata = Schema.decodeUnknownSync(metadataSchema)(
      await Effect.runPromise(client.extraction.getMetadata({ query }))
    )
    return resolveClientMetadataIconUrls(metadata)
  },
}
