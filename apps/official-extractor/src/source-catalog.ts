import {
  matchExtractorUrl,
  type ExtractorManifest,
  type ExtractorMatcher,
  type ExtractorSourceCredential,
  type ExtractSuccessResponse,
  type ExtractRequest,
} from "@lynvo/extractor-protocol"
import {
  BHADOO_SOURCE_ID,
  EXTRACTOR_ID,
  EXTRACTOR_NAME,
  ONEDRIVE_SOURCE_ID,
  SOURCE_IMPLEMENTATION_VERSION,
} from "./constants"
import { extractBhadooGoogleDriveIndex } from "./sources/bhadoo-google-drive-index"
import { extractOneDriveIndex } from "./sources/onedrive-index"

export interface SourceAdapterOptions {
  request: ExtractRequest
  targetUrl: string
  source: OfficialSourceDefinition
  publicAssetOrigin: string
}

export interface OfficialSourceDefinition {
  id: string
  displayName: string
  description: string
  homepage: string
  iconPath: string
  status: "active" | "maintenance" | "degraded" | "down"
  version: string
  matchers: ExtractorMatcher[]
  credential: ExtractorSourceCredential
  extract: (options: SourceAdapterOptions) => Promise<ExtractSuccessResponse>
}

const bhadooMatchers: ExtractorMatcher[] = [
  {
    hosts: ["drive.example.invalid"],
    hostPatterns: ["*"],
    pathPatterns: ["/0:/**"],
    schemes: ["https"],
  },
]

const oneDriveMatchers: ExtractorMatcher[] = [
  {
    hosts: ["onedrive.example.invalid"],
    hostPatterns: ["*"],
    pathPatterns: ["/**"],
    schemes: ["https"],
  },
]

export const OFFICIAL_SOURCE_CATALOG: OfficialSourceDefinition[] = [
  {
    id: BHADOO_SOURCE_ID,
    displayName: "Bhadoo’s Google Drive Index",
    description:
      "Extracts playable files and lazy folders from Bhadoo Google Drive Index deployments.",
    homepage: "https://gitlab.com/GoogleDriveIndex/Google-Drive-Index",
    iconPath: "/icons/plugins/bhadoo-google-drive-index.webp",
    status: "active",
    version: SOURCE_IMPLEMENTATION_VERSION,
    matchers: bhadooMatchers,
    credential: { kind: "http-basic", scope: "domain", required: false },
    extract: extractBhadooGoogleDriveIndex,
  },
  {
    id: ONEDRIVE_SOURCE_ID,
    displayName: "Spencerwooo's OneDrive Vercel Index",
    description:
      "Extracts playable files and lazy folders from OneDrive Vercel Index deployments.",
    homepage: "https://github.com/spencerwooo/onedrive-vercel-index",
    iconPath: "/icons/plugins/onedrive-index.webp",
    status: "active",
    version: SOURCE_IMPLEMENTATION_VERSION,
    matchers: oneDriveMatchers,
    credential: { kind: "domain-password", scope: "domain", required: false },
    extract: extractOneDriveIndex,
  },
]

export const findOfficialSource = (
  targetUrl: string
): OfficialSourceDefinition | undefined =>
  OFFICIAL_SOURCE_CATALOG.find((source) =>
    matchExtractorUrl(targetUrl, source.matchers)
  )

export const createOfficialManifest = (
  publicAssetOrigin: string
): ExtractorManifest => ({
  protocolVersion: "1.0",
  extractorId: EXTRACTOR_ID,
  displayName: EXTRACTOR_NAME,
  homepage: "https://lynvo.example",
  auth: { type: "bearer" },
  usage: { endpoint: "/usage" },
  matchers: OFFICIAL_SOURCE_CATALOG.flatMap((source) => source.matchers),
  features: { password: true, lazyNodes: true, basicAuth: true },
  extensions: {
    lynvo: {
      sources: OFFICIAL_SOURCE_CATALOG.map((source) => ({
        id: source.id,
        displayName: source.displayName,
        description: source.description,
        homepage: source.homepage,
        iconUrl: `${publicAssetOrigin}${source.iconPath}`,
        status: source.status,
        version: source.version,
        hosts: source.matchers.flatMap((matcher) => matcher.hosts),
        matchers: source.matchers,
        credential: source.credential,
      })),
    },
  },
})

export const extractFromOfficialSource = async (
  request: ExtractRequest,
  targetUrl: string,
  publicAssetOrigin: string
): Promise<ExtractSuccessResponse> => {
  const source = findOfficialSource(targetUrl)
  if (!source) {
    throw new Error("UNSUPPORTED_URL")
  }
  return source.extract({ request, targetUrl, source, publicAssetOrigin })
}

export const createSourceResponseMetadata = (
  source: OfficialSourceDefinition,
  publicAssetOrigin: string,
  pageTitle?: string
): ExtractSuccessResponse["source"] => ({
  extractorId: EXTRACTOR_ID,
  displayName: EXTRACTOR_NAME,
  sourceId: source.id,
  sourceName: source.displayName,
  sourceIconUrl: `${publicAssetOrigin}${source.iconPath}`,
  ...(pageTitle ? { pageTitle } : {}),
})
