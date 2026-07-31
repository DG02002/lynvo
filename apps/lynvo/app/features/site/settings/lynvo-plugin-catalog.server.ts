import { getLynvoManifestExtension } from "@lynvo/plugin-server-protocol"
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
    ).getManifest({ apiKey: environment.LYNVO_PLUGIN_SERVER_API_KEY })
    return (getLynvoManifestExtension(manifest).plugins ?? []).map(
      (plugin) => ({
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
            ? "Add the source domain. Optional HTTP Basic Auth credentials are encrypted when saved."
            : plugin.credential
              ? "Add the source domain. Optional domain passwords are encrypted when saved."
              : "",
        ...(plugin.credential
          ? { credentialKind: plugin.credential.kind }
          : {}),
        ...(plugin.status ? { status: plugin.status } : {}),
        ...(plugin.version ? { version: plugin.version } : {}),
      })
    )
  } catch (error) {
    console.error({
      event: "lynvo_plugin_server_manifest_load_failed",
      error,
    })
    return null
  }
}
