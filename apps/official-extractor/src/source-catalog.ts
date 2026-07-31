import {
  matchExtractorUrl,
  type ExtractorManifest,
  type ExtractorMatcher,
  type ExtractorSourceCredential,
  type ExtractSuccessResponse,
  type ExtractRequest,
  type DiscoverResponse,
} from "@lynvo/extractor-protocol"
import {
  BHADOO_SOURCE_ID,
  EXTRACTOR_ID,
  EXTRACTOR_NAME,
  GOOGLE_DRIVE_PUBLIC_FILES_SOURCE_ID,
  ONEDRIVE_SOURCE_ID,
  SOURCE_IMPLEMENTATION_VERSION,
} from "./constants"
import { extractBhadooGoogleDriveIndex } from "./sources/bhadoo-google-drive-index"
import { extractGoogleDrivePublicLink } from "./sources/google-drive-public-files"
import { extractOneDriveIndex } from "./sources/onedrive-index"

export interface SourceAdapterOptions {
  request: ExtractRequest
  targetUrl: string
  source: OfficialSourceDefinition
  publicAssetOrigin?: string
}

export interface OfficialSourceDefinition {
  id: string
  displayName: string
  description: string
  homepage: string
  iconPath?: string
  status: "active" | "maintenance" | "degraded" | "down"
  version: string
  matchers: ExtractorMatcher[]
  credential?: ExtractorSourceCredential
  discovery?: { confidence: "pattern" | "verified" }
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

const googleDrivePublicFileMatchers: ExtractorMatcher[] = [
  {
    hosts: ["drive.google.com"],
    pathPatterns: ["/file/d/**", "/drive/folders/**"],
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
    status: "active",
    version: SOURCE_IMPLEMENTATION_VERSION,
    matchers: bhadooMatchers,
    credential: { kind: "http-basic", scope: "domain", required: false },
    discovery: { confidence: "pattern" },
    extract: extractBhadooGoogleDriveIndex,
  },
  {
    id: GOOGLE_DRIVE_PUBLIC_FILES_SOURCE_ID,
    displayName: "Google Drive Public Files",
    description:
      "Extracts public Google Drive files and folders shared with anyone who has the link.",
    homepage: "https://drive.google.com",
    iconPath: "/icons/sources/google-drive-public-files.webp",
    status: "active",
    version: SOURCE_IMPLEMENTATION_VERSION,
    matchers: googleDrivePublicFileMatchers,
    extract: extractGoogleDrivePublicLink,
  },
  {
    id: ONEDRIVE_SOURCE_ID,
    displayName: "Spencerwooo's OneDrive Vercel Index",
    description:
      "Extracts playable files and lazy folders from OneDrive Vercel Index deployments.",
    homepage: "https://github.com/spencerwooo/onedrive-vercel-index",
    iconPath: "/icons/sources/onedrive-index.webp",
    status: "active",
    version: SOURCE_IMPLEMENTATION_VERSION,
    matchers: oneDriveMatchers,
    credential: { kind: "domain-password", scope: "domain", required: false },
    extract: extractOneDriveIndex,
  },
]

export const findOfficialSource = (
  targetUrl: string,
  sourceId?: string
): OfficialSourceDefinition | undefined =>
  sourceId
    ? OFFICIAL_SOURCE_CATALOG.find((source) => source.id === sourceId)
    : OFFICIAL_SOURCE_CATALOG.find((source) =>
        matchExtractorUrl(targetUrl, source.matchers)
      )

export const createOfficialManifest = (
  publicAssetOrigin?: string
): ExtractorManifest => ({
  protocolVersion: "1.0",
  extractorId: EXTRACTOR_ID,
  displayName: EXTRACTOR_NAME,
  hasIcon: false,
  homepage: "https://lynvo.example",
  auth: { type: "bearer" },
  usage: { endpoint: "/usage" },
  matchers: OFFICIAL_SOURCE_CATALOG.flatMap((source) => source.matchers),
  features: {
    password: true,
    lazyNodes: true,
    basicAuth: true,
    discovery: true,
  },
  extensions: {
    lynvo: {
      sources: OFFICIAL_SOURCE_CATALOG.map((source) => ({
        id: source.id,
        displayName: source.displayName,
        description: source.description,
        homepage: source.homepage,
        hasIcon: Boolean(publicAssetOrigin && source.iconPath),
        ...(publicAssetOrigin && source.iconPath
          ? { iconUrl: `${publicAssetOrigin}${source.iconPath}` }
          : {}),
        status: source.status,
        version: source.version,
        hosts: source.matchers.flatMap((matcher) => matcher.hosts),
        matchers: source.matchers,
        ...(source.credential ? { credential: source.credential } : {}),
      })),
    },
  },
})

export const discoverOfficialSource = (targetUrl: string): DiscoverResponse => {
  const source = OFFICIAL_SOURCE_CATALOG.find(
    (candidate) =>
      candidate.discovery && matchExtractorUrl(targetUrl, candidate.matchers)
  )
  return source?.discovery
    ? {
        matched: true,
        sourceId: source.id,
        confidence: source.discovery.confidence,
      }
    : { matched: false }
}

export const extractFromOfficialSource = async (
  request: ExtractRequest,
  targetUrl: string,
  publicAssetOrigin?: string
): Promise<ExtractSuccessResponse> => {
  const source = findOfficialSource(targetUrl, request.sourceId)
  if (!source) {
    throw new Error("UNSUPPORTED_URL")
  }
  return source.extract({ request, targetUrl, source, publicAssetOrigin })
}

export const createSourceResponseMetadata = (
  source: OfficialSourceDefinition,
  publicAssetOrigin?: string,
  pageTitle?: string
): ExtractSuccessResponse["source"] => ({
  extractorId: EXTRACTOR_ID,
  displayName: EXTRACTOR_NAME,
  sourceId: source.id,
  sourceName: source.displayName,
  ...(publicAssetOrigin && source.iconPath
    ? { sourceIconUrl: `${publicAssetOrigin}${source.iconPath}` }
    : {}),
  ...(pageTitle ? { pageTitle } : {}),
})
