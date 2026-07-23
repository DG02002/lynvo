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

export const getWorkerManifestView = (
  manifestValue: string
): WorkerManifestView => {
  const manifest = parseWorkerManifest(manifestValue)
  const extension = manifest ? getLynvoManifestExtension(manifest) : undefined
  const hosts =
    manifest?.matchers?.flatMap((matcher) => matcher.hosts ?? []).join(", ") ||
    "None"

  return {
    name: manifest?.displayName || manifest?.extractorId || "Unknown",
    icon: manifest?.iconUrl || null,
    hosts,
    sources: (extension?.sources ?? []).map((source) => ({
      ...source,
      iconUrl: source.iconUrl?.replace(/\.png(?=$|[?#])/, ".webp"),
    })),
  }
}
