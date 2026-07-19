import type { PluginIconSource } from "~/lib/plugin-icons"

export interface OfficialPlugin {
  id: string
  name: string
  sourceUrl: string
  icon: PluginIconSource
  description: string
  supportsDomains: boolean
  domainRequired: string
  credentialKind?: "domain-password" | "http-basic"
  status?: "active" | "maintenance" | "degraded" | "down"
  version?: string
}
