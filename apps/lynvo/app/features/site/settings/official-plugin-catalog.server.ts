import { getLynvoManifestExtension } from "@lynvo/extractor-protocol"
import {
  ExtractorProtocolClient,
  ServiceBindingExtractorTransport,
} from "~/lib/extraction/extractor-protocol-client"
import type { OfficialPlugin } from "./plugin-settings-data"

export const loadOfficialPlugins = async (
  environment: Env
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
        icon: source.iconUrl ? { url: source.iconUrl } : {},
        description: source.description ?? "Official extractor source.",
        supportsDomains: true,
        domainRequired:
          source.credential?.kind === "http-basic"
            ? "Add the source domain. Optional HTTP Basic Auth credentials are encrypted when saved."
            : "Add the source domain. Optional domain passwords are encrypted when saved.",
        ...(source.credential
          ? { credentialKind: source.credential.kind }
          : {}),
        ...(source.status ? { status: source.status } : {}),
        ...(source.version ? { version: source.version } : {}),
      })
    )
  } catch {
    return null
  }
}
