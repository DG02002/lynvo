import { getLynvoManifestExtension } from "@dg02002/lynvo-plugin-server-protocol"
import {
  PluginServerClient,
  ServiceBindingPluginServerTransport,
} from "~/lib/extraction/plugin-server-client"
import type { LynvoPlugin } from "./plugin-settings-data"

export const resolveLynvoPluginIconUrl = (
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

export const loadLynvoPlugins = async (
  environment: Env,
  requestUrl: string
): Promise<LynvoPlugin[] | null> => {
  try {
    const manifest = await new PluginServerClient(
      new ServiceBindingPluginServerTransport(environment.LYNVO_PLUGIN_SERVER)
    ).getManifest({ apiKey: environment.MANAGED_PLUGIN_SERVER_API_KEY })
    return (getLynvoManifestExtension(manifest).plugins ?? []).map((plugin) => {
      const result: LynvoPlugin = {
        id: plugin.id,
        name: plugin.displayName,
        sourceUrl:
          plugin.homepage ??
          manifest.homepage ??
          "https://lynvo.dg02002.workers.dev",
        icon: plugin.iconUrl
          ? { url: resolveLynvoPluginIconUrl(plugin.iconUrl, requestUrl) }
          : {},
        description: plugin.description ?? "Lynvo Plugin Server plugin.",
        supportsDomains: Boolean(plugin.credential),
        domainRequired:
          plugin.credential?.kind === "http-basic"
            ? "Add the Plugin Domain. Optional Plugin Credentials are encrypted when saved."
            : plugin.credential
              ? "Add the Plugin Domain. Optional Plugin Credentials are encrypted when saved."
              : "",
      }
      if (plugin.credential) {
        result.credentialKind = plugin.credential.kind
      }
      if (plugin.status) {
        result.status = plugin.status
      }
      if (plugin.version) {
        result.version = plugin.version
      }
      if (plugin.usageMultiplier) {
        result.usageMultiplier = plugin.usageMultiplier
      }
      if (plugin.proxyCreditUsage) {
        result.proxyCreditUsage = plugin.proxyCreditUsage
      }
      return result
    })
  } catch (error) {
    console.error({
      event: "lynvo_plugin_server_manifest_load_failed",
      error,
    })
    return null
  }
}
