import {
  getLynvoManifestExtension,
  manifestSchema,
  type ExtractorSourceMetadata,
  type ExtractorManifest,
} from "@lynvo/extractor-protocol"

export interface WorkerManifestView {
  name: string
  icon: string | null
  hosts: string
  sources: ExtractorSourceMetadata[]
}

const parseWorkerManifest = (value: string): ExtractorManifest | null => {
  try {
    const parsed: unknown = JSON.parse(value)
    const result = manifestSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

const resolveExternalWorkerIconUrl = (
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

export const getWorkerManifestView = (
  manifestValue: string,
  requestOrigin?: string
): WorkerManifestView => {
  const manifest = parseWorkerManifest(manifestValue)
  const extension = manifest ? getLynvoManifestExtension(manifest) : undefined
  const hosts =
    manifest?.matchers?.flatMap((matcher) => matcher.hosts ?? []).join(", ") ||
    "None"

  return {
    name: manifest?.displayName || manifest?.extractorId || "Unknown",
    icon:
      resolveExternalWorkerIconUrl(manifest?.iconUrl, requestOrigin) ?? null,
    hosts,
    sources: (extension?.sources ?? []).map((source) => ({
      ...source,
      iconUrl: resolveExternalWorkerIconUrl(
        source.iconUrl?.replace(/\.png(?=$|[?#])/, ".webp"),
        requestOrigin
      ),
    })),
  }
}
