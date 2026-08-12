import {
  matchPluginServerUrl,
  type PluginServerManifest,
  type PluginServerMatcher,
  type PluginCredential,
  type ExtractSuccessResponse,
  type ExtractRequest,
  type DiscoverResponse,
} from "@dg02002/lynvo-plugin-server-protocol"
import { load } from "cheerio"
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
import {
  fetchValidatedUpstream,
  readBoundedUpstreamText,
} from "./upstream-response"

const ONEDRIVE_INDEX_REPOSITORY_URL =
  "https://github.com/spencerwooo/onedrive-vercel-index"

export interface PluginAdapterOptions {
  request: ExtractRequest
  targetUrl: string
  plugin: LynvoPluginDefinition
  publicAssetOrigin?: string
}

export interface LynvoPluginDefinition {
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
  extract: (options: PluginAdapterOptions) => Promise<ExtractSuccessResponse>
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

export const LYNVO_PLUGIN_CATALOG: LynvoPluginDefinition[] = [
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

export const findLynvoPlugin = (
  targetUrl: string,
  pluginId?: string
): LynvoPluginDefinition | undefined =>
  pluginId
    ? LYNVO_PLUGIN_CATALOG.find((plugin) => plugin.id === pluginId)
    : LYNVO_PLUGIN_CATALOG.find((plugin) =>
        matchPluginServerUrl(targetUrl, plugin.matchers)
      )

export const createLynvoPluginServerManifest = (
  publicAssetOrigin?: string
): PluginServerManifest => ({
  protocolVersion: "1.0",
  pluginServerId: PLUGIN_SERVER_ID,
  displayName: PLUGIN_SERVER_NAME,
  hasIcon: false,
  homepage: "https://lynvo.dg02002.workers.dev",
  auth: { type: "bearer" },
  usage: { endpoint: "/usage" },
  matchers: LYNVO_PLUGIN_CATALOG.flatMap((plugin) => plugin.matchers),
  features: {
    password: true,
    lazyNodes: true,
    basicAuth: true,
    discovery: true,
  },
  extensions: {
    lynvo: {
      plugins: LYNVO_PLUGIN_CATALOG.map((plugin) => ({
        id: plugin.id,
        displayName: plugin.displayName,
        description: plugin.description,
        homepage: plugin.homepage,
        hasIcon: Boolean(publicAssetOrigin && plugin.iconPath),
        ...(publicAssetOrigin && plugin.iconPath
          ? { iconUrl: `${publicAssetOrigin}${plugin.iconPath}` }
          : {}),
        status: plugin.status,
        version: plugin.version,
        hosts: plugin.matchers.flatMap((matcher) => matcher.hosts),
        matchers: plugin.matchers,
        ...(plugin.credential ? { credential: plugin.credential } : {}),
      })),
    },
  },
})

export const discoverLynvoPlugin = async (
  targetUrl: string
): Promise<DiscoverResponse> => {
  const plugin = LYNVO_PLUGIN_CATALOG.find(
    (candidate) =>
      candidate.discovery && matchPluginServerUrl(targetUrl, candidate.matchers)
  )
  if (plugin?.discovery) {
    return {
      matched: true,
      pluginId: plugin.id,
      confidence: plugin.discovery.confidence,
    }
  }

  try {
    const response = await fetchValidatedUpstream(targetUrl, {
      headers: { Accept: "text/html" },
    })
    if (!response.ok) {
      await response.body?.cancel()
      return { matched: false }
    }
    const document = load(await readBoundedUpstreamText(response))
    if (document(`a[href="${ONEDRIVE_INDEX_REPOSITORY_URL}"]`).length > 0) {
      return {
        matched: true,
        pluginId: ONEDRIVE_SOURCE_ID,
        confidence: "verified",
      }
    }
  } catch {
    return { matched: false }
  }

  return { matched: false }
}

export const extractWithLynvoPlugin = async (
  request: ExtractRequest,
  targetUrl: string,
  publicAssetOrigin?: string
): Promise<ExtractSuccessResponse> => {
  const plugin = findLynvoPlugin(targetUrl, request.pluginId)
  if (!plugin) {
    throw new Error("UNSUPPORTED_URL")
  }
  return plugin.extract({ request, targetUrl, plugin, publicAssetOrigin })
}

export const createPluginResponseMetadata = (
  plugin: LynvoPluginDefinition,
  publicAssetOrigin?: string,
  pageTitle?: string
): ExtractSuccessResponse["plugin"] => ({
  pluginServerId: PLUGIN_SERVER_ID,
  displayName: PLUGIN_SERVER_NAME,
  pluginId: plugin.id,
  pluginName: plugin.displayName,
  ...(publicAssetOrigin && plugin.iconPath
    ? { pluginIconUrl: `${publicAssetOrigin}${plugin.iconPath}` }
    : {}),
  ...(pageTitle ? { pageTitle } : {}),
})
