import {
  getLynvoManifestExtension,
  parsePluginServerManifestContract,
  type PluginMetadata,
  type PluginServerManifest,
} from "@dg02002/lynvo-plugin-server-protocol"

export interface PluginServerManifestView {
  name: string
  icon: string | null
  hosts: string
  plugins: PluginMetadata[]
}

const parsePluginServerManifestForDisplay = (
  value: string
): PluginServerManifest | null => {
  try {
    const parsed: unknown = JSON.parse(value)
    const result = parsePluginServerManifestContract(parsed)
    return result.ok ? (result.value ?? null) : null
  } catch {
    return null
  }
}

const resolveCustomPluginServerIconUrl = (
  iconUrl: string | undefined,
  requestOrigin?: string
): string | undefined => {
  if (!iconUrl || !requestOrigin) {
    return iconUrl
  }

  const icon = new URL(iconUrl)
  if (
    icon.hostname !== "localhost" &&
    icon.hostname !== "127.0.0.1" &&
    icon.hostname !== "[::1]"
  ) {
    return iconUrl
  }

  icon.hostname = new URL(requestOrigin).hostname
  return icon.href
}

export const getPluginServerManifestView = (
  manifestValue: string,
  requestOrigin?: string
): PluginServerManifestView => {
  const manifest = parsePluginServerManifestForDisplay(manifestValue)
  const extension = manifest ? getLynvoManifestExtension(manifest) : undefined
  const hosts =
    manifest?.matchers?.flatMap((matcher) => matcher.hosts ?? []).join(", ") ||
    "None"

  return {
    name: manifest?.displayName || manifest?.pluginServerId || "Unknown",
    icon:
      resolveCustomPluginServerIconUrl(manifest?.iconUrl, requestOrigin) ??
      null,
    hosts,
    plugins: (extension?.plugins ?? []).map((source) => ({
      ...source,
      iconUrl: resolveCustomPluginServerIconUrl(
        source.iconUrl?.replace(/\.png(?=$|[?#])/, ".webp"),
        requestOrigin
      ),
    })),
  }
}
