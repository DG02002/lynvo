import {
  BUILT_IN_PLUGIN_ICONS,
  type PluginIconSource,
} from "~/lib/plugin-icons"

export interface OfficialPlugin {
  id: string
  name: string
  sourceUrl: string
  icon: PluginIconSource
  description: string
  supportsDomains: boolean
  domainRequired: string
  credentialKind?: "domain-password" | "http-basic"
}

export const officialPlugins: readonly OfficialPlugin[] = [
  {
    id: "bhadoo-google-drive-index",
    name: "Bhadoo’s Google Drive Index",
    sourceUrl: "https://gitlab.com/GoogleDriveIndex/Google-Drive-Index",
    icon: BUILT_IN_PLUGIN_ICONS["Bhadoo’s Google Drive Index"],
    description:
      "Extracts folders and signed file links from user-hosted Bhadoo Google Drive Index servers.",
    supportsDomains: true,
    credentialKind: "http-basic",
    domainRequired:
      "Add your Bhadoo index domain so Lynvo invokes this plugin for links from your server. HTTP Basic Auth credentials are encrypted when saved.",
  },
  {
    id: "onedrive-index",
    name: "Spencerwooo's Onedrive Vercel Index",
    sourceUrl: "https://github.com/spencerwooo/onedrive-vercel-index",
    icon: { url: "/icons/plugins/onedrive-index.webp" },
    description:
      "Extracts folder and file links from user-hosted OneDrive index servers.",
    supportsDomains: true,
    credentialKind: "domain-password",
    domainRequired:
      "Add your index server domain so Lynvo knows when to use this plugin. Smart detection still runs for known OneDrive index pages.",
  },
]
