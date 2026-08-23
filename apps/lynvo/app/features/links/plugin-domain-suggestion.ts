import type { MetaData } from "./types"
import type {
  PluginDomainCandidate,
  PluginDomainSuggestion,
} from "~/lib/plugin-domain"

export const createPluginDomainSuggestion = (
  candidate: PluginDomainCandidate | undefined,
  meta: MetaData
): PluginDomainSuggestion | undefined => {
  if (
    !candidate ||
    !meta.pluginId ||
    !meta.pluginServerId ||
    !meta.sourceCredentialKind
  ) {
    return undefined
  }

  return {
    ...candidate,
    pluginIconUrl: meta.sourceIconUrl ?? meta.pluginIcon,
    pluginId: meta.pluginId,
    pluginName: meta.sourceName ?? meta.pluginName ?? meta.pluginId,
    pluginServerId: meta.pluginServerId,
  }
}
