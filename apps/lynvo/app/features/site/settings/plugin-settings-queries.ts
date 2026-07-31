import { QueryClient } from "@tanstack/react-query"

export const PLUGIN_SERVERS_QUERY_KEY = ["settings", "plugin-servers"]
export const PLUGIN_DOMAINS_QUERY_KEY = ["settings", "plugin-domains"]

export const invalidatePluginSettings = async (
  queryClient: QueryClient
): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: PLUGIN_SERVERS_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: PLUGIN_DOMAINS_QUERY_KEY }),
  ])
}
