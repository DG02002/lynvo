import { Effect } from "effect"
import type { Plugin } from "../../../lib/plugins/types"
import { fetchUrl } from "../../../lib/scraper"
import { ConvexError, ExtractionError } from "../errors"
import type {
  ExtractionResult,
  MetadataOptions,
  MetadataResult,
} from "./extractor-types"

export const extractFromPlugin = Effect.fn(
  "PluginExtractorAdapter.extractFromPlugin"
)(function* (
  plugin: Plugin,
  targetUrl: string,
  password?: string
): Effect.fn.Return<ExtractionResult, ExtractionError> {
  const result = yield* Effect.tryPromise({
    try: () => plugin.extract(targetUrl, password),
    catch: (cause) =>
      new ExtractionError({
        message: cause instanceof Error ? cause.message : String(cause),
        url: targetUrl,
      }),
  })
  const links = Array.isArray(result) ? result : result.links
  const meta = Array.isArray(result) ? undefined : result.meta
  return meta === undefined ? { links } : { links, meta }
})

export const getPluginMetadata = Effect.fn(
  "PluginExtractorAdapter.getPluginMetadata"
)(function* (
  plugin: Plugin,
  options: MetadataOptions
): Effect.fn.Return<MetadataResult, ConvexError> {
  const fetchResult = yield* Effect.tryPromise({
    try: () =>
      plugin.fetch
        ? plugin.fetch(options.url, options.env)
        : fetchUrl(options.url, "GET"),
    catch: (cause) =>
      new ConvexError({ message: "Metadata fetch failed", cause }),
  })

  let filename =
    plugin.getFilename(options.url, fetchResult.$, fetchResult.headers) ?? ""
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
    pluginId: plugin.id,
    pluginName: plugin.name,
    ...(plugin.icon.url ? { pluginIcon: plugin.icon.url } : {}),
  }
})
