import { Effect } from "effect"
import type { ExtractedLink, MetaData } from "~/features/links/types"
import { client } from "~/lib/effect/api/client"

export const defaultExtractionClient: ExtractionTransport = {
  extract: async (query) =>
    (await Effect.runPromise(
      client.extractor.extract({ query })
    )) as unknown as {
      links: ExtractedLink[]
      meta?: MetaData
    },
  getMetadata: async (query) =>
    (await Effect.runPromise(
      client.extractor.getMetadata({ query })
    )) as MetaData,
}
