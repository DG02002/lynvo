import { getLynvoManifestExtension } from "@lynvo/extractor-protocol"
import {
  ExtractorProtocolClient,
  ServiceBindingExtractorTransport,
} from "~/lib/extraction/extractor-protocol-client"
import type { OfficialPlugin } from "./plugin-settings-data"

export const resolveOfficialPluginIconUrl = (
  iconUrl: string,
  requestUrl: string
) => {
  const icon = new URL(iconUrl)
  if (
    icon.hostname !== "localhost" &&
    icon.hostname !== "127.0.0.1" &&
    icon.hostname !== "[::1]"
  ) {
    return iconUrl
  }

  const requestOrigin = new URL(requestUrl).origin
  return new URL(`${icon.pathname}${icon.search}${icon.hash}`, requestOrigin)
    .href
}

export const loadOfficialPlugins = async (
  environment: Env,
  requestUrl: string
): Promise<OfficialPlugin[] | null> => {
  try {
    const manifest = await new ExtractorProtocolClient(
      new ServiceBindingExtractorTransport(environment.OFFICIAL_EXTRACTOR)
    ).getManifest({ apiKey: environment.OFFICIAL_EXTRACTOR_API_KEY })
    return (getLynvoManifestExtension(manifest).sources ?? []).map(
      (source) => ({
        id: source.id,
        name: source.displayName,
        sourceUrl:
          source.homepage ?? manifest.homepage ?? "https://lynvo.example",
        icon: source.iconUrl
          ? { url: resolveOfficialPluginIconUrl(source.iconUrl, requestUrl) }
          : {},
        description: source.description ?? "Official extractor source.",
        supportsDomains: Boolean(source.credential),
        domainRequired:
          source.credential?.kind === "http-basic"
            ? "Add the source domain. Optional HTTP Basic Auth credentials are encrypted when saved."
            : source.credential
              ? "Add the source domain. Optional domain passwords are encrypted when saved."
              : "",
        ...(source.credential
          ? { credentialKind: source.credential.kind }
          : {}),
        ...(source.status ? { status: source.status } : {}),
        ...(source.version ? { version: source.version } : {}),
      })
    )
  } catch (error) {
    console.error({
      event: "official_extractor_manifest_load_failed",
      error,
    })
    return null
  }
}
