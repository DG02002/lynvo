import { Effect } from "effect"
import type { ExtractedLink, MetaData } from "~/features/links/types"
import { client } from "~/lib/effect/api/client"
import { resolveMetadataIconUrls } from "./metadata-icon-urls"

const resolveClientMetadataIconUrls = (metadata: MetaData) =>
  typeof window === "undefined"
    ? metadata
    : resolveMetadataIconUrls(metadata, window.location.href)

export const defaultExtractionClient: ExtractionTransport = {
  extract: async (query) => {
    const result = (await Effect.runPromise(
      client.extraction.extract({ query })
    )) as unknown as {
      links: ExtractedLink[]
      meta?: MetaData
    }
    return {
      ...result,
      ...(result.meta
        ? { meta: resolveClientMetadataIconUrls(result.meta) }
        : {}),
    }
  },
  getMetadata: async (query) => {
    const metadata = (await Effect.runPromise(
      client.extraction.getMetadata({ query })
    )) as MetaData
    return resolveClientMetadataIconUrls(metadata)
  },
}
