import {
  matchPluginServerUrl,
  type PluginServerManifest,
  type PluginServerMatcher,
  type PluginCredential,
  type ExtractSuccessResponse,
  type ExtractRequest,
  type DiscoverResponse,
} from "@lynvo/plugin-server-protocol"
import {
  BHADOO_SOURCE_ID,
  PLUGIN_SERVER_ID,
  PLUGIN_SERVER_NAME,
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
  matchers: PluginServerMatcher[]
  credential?: PluginCredential
  discovery?: { confidence: "pattern" | "verified" }
  extract: (options: SourceAdapterOptions) => Promise<ExtractSuccessResponse>
}

const bhadooMatchers: PluginServerMatcher[] = [
  {
    hosts: ["drive.example.invalid"],
    hostPatterns: ["*"],
    pathPatterns: ["/0:/**"],
    schemes: ["https"],
  },
]

const oneDriveMatchers: PluginServerMatcher[] = [
  {
    hosts: ["onedrive.example.invalid"],
    hostPatterns: ["*"],
    pathPatterns: ["/**"],
    schemes: ["https"],
  },
]

const googleDrivePublicFileMatchers: PluginServerMatcher[] = [
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
    displayName: "Google Drive Public Folders & Files",
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
  pluginId?: string
): OfficialSourceDefinition | undefined =>
  pluginId
    ? OFFICIAL_SOURCE_CATALOG.find((source) => source.id === pluginId)
    : OFFICIAL_SOURCE_CATALOG.find((source) =>
        matchPluginServerUrl(targetUrl, source.matchers)
      )

export const createOfficialManifest = (
  publicAssetOrigin?: string
): PluginServerManifest => ({
  protocolVersion: "1.0",
  pluginServerId: PLUGIN_SERVER_ID,
  displayName: PLUGIN_SERVER_NAME,
  hasIcon: false,
  homepage: "https://lynvo.dg02002.workers.dev",
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
      plugins: OFFICIAL_SOURCE_CATALOG.map((source) => ({
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
      candidate.discovery && matchPluginServerUrl(targetUrl, candidate.matchers)
  )
  return source?.discovery
    ? {
        matched: true,
        pluginId: source.id,
        confidence: source.discovery.confidence,
      }
    : { matched: false }
}

export const extractFromOfficialSource = async (
  request: ExtractRequest,
  targetUrl: string,
  publicAssetOrigin?: string
): Promise<ExtractSuccessResponse> => {
  const source = findOfficialSource(targetUrl, request.pluginId)
  if (!source) {
    throw new Error("UNSUPPORTED_URL")
  }
  return source.extract({ request, targetUrl, source, publicAssetOrigin })
}

export const createSourceResponseMetadata = (
  source: OfficialSourceDefinition,
  publicAssetOrigin?: string,
  pageTitle?: string
): ExtractSuccessResponse["plugin"] => ({
  pluginServerId: PLUGIN_SERVER_ID,
  displayName: PLUGIN_SERVER_NAME,
  pluginId: source.id,
  pluginName: source.displayName,
  ...(publicAssetOrigin && source.iconPath
    ? { pluginIconUrl: `${publicAssetOrigin}${source.iconPath}` }
    : {}),
  ...(pageTitle ? { pageTitle } : {}),
})
