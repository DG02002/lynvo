import type { MetaData } from "~/features/links/types"

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])

const resolveIconUrl = (iconUrl: string | undefined, requestUrl: string) => {
  if (!iconUrl) {
    return undefined
  }

  const icon = new URL(iconUrl)
  if (!LOOPBACK_HOSTS.has(icon.hostname)) {
    return iconUrl
  }

  const requestOrigin = new URL(requestUrl).origin
  return new URL(`${icon.pathname}${icon.search}${icon.hash}`, requestOrigin)
    .href
}

export const resolveMetadataIconUrls = (
  metadata: MetaData,
  requestUrl: string
): MetaData => ({
  ...metadata,
  ...(metadata.pluginIcon
    ? { pluginIcon: resolveIconUrl(metadata.pluginIcon, requestUrl) }
    : {}),
  ...(metadata.sourceIconUrl
    ? { sourceIconUrl: resolveIconUrl(metadata.sourceIconUrl, requestUrl) }
    : {}),
  ...(metadata.routeSourceIconUrl
    ? {
        routeSourceIconUrl: resolveIconUrl(
          metadata.routeSourceIconUrl,
          requestUrl
        ),
      }
    : {}),
})
