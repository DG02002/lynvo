import { Effect } from "effect"
import type { DirectMediaAdapter } from "../../../lib/plugins/direct-media-adapter"
import { ConvexError, ExtractionError } from "../errors"
import type {
  ExtractionResult,
  MetadataOptions,
  MetadataResult,
} from "./extraction-types"

export const extractDirectMedia = Effect.fn(
  "DirectMediaAdapter.extractDirectMedia"
)(function* (
  adapter: DirectMediaAdapter,
  targetUrl: string
): Effect.fn.Return<ExtractionResult, ExtractionError> {
  const result = yield* Effect.tryPromise({
    try: () => adapter.extract(targetUrl),
    catch: (cause) =>
      new ExtractionError({
        message: cause instanceof Error ? cause.message : String(cause),
        url: targetUrl,
      }),
  })
  return { links: result }
})

export const getDirectMediaMetadata = Effect.fn(
  "DirectMediaAdapter.getDirectMediaMetadata"
)(function* (
  adapter: DirectMediaAdapter,
  options: MetadataOptions
): Effect.fn.Return<MetadataResult, ConvexError> {
  const fetchResult = yield* Effect.tryPromise({
    try: () => adapter.fetch(options.url, options.env),
    catch: (cause) =>
      new ConvexError({ message: "Metadata fetch failed", cause }),
  })

  let filename =
    adapter.getFilename(options.url, fetchResult.$, fetchResult.headers) ?? ""
  if (!filename && fetchResult.$) {
    const title = fetchResult.$("title").text().trim()
    if (
      title &&
      title.toLowerCase() !== "play now" &&
      title.toLowerCase() !== "watch video"
    ) {
      filename = title
    }
  }

  return {
    filename,
    pluginId: adapter.id,
    pluginName: adapter.name,
    ...(adapter.icon.url ? { pluginIcon: adapter.icon.url } : {}),
  }
})
