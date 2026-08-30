import * as React from "react"
import type { PluginDomainDraft } from "./plugin-settings-interaction"

const EMPTY_DOMAIN_DRAFT: PluginDomainDraft = {
  domain: "",
  username: "",
  password: "",
  isCredentialEnabled: false,
}

export const usePluginDomainDrafts = () => {
  const [domainDrafts, setDomainDrafts] = React.useState<
    Record<string, PluginDomainDraft>
  >({})

  const updateDomainDraft = React.useCallback(
    (pluginId: string, update: Partial<PluginDomainDraft>) => {
      setDomainDrafts((current) => {
        const next = { ...(current[pluginId] ?? EMPTY_DOMAIN_DRAFT), ...update }
        return {
          ...current,
          [pluginId]: next.isCredentialEnabled
            ? next
            : { ...next, username: "", password: "" },
        }
      })
    },
    []
  )

  const clearDomainDraft = React.useCallback((pluginId: string) => {
    setDomainDrafts((current) => ({
      ...current,
      [pluginId]: EMPTY_DOMAIN_DRAFT,
    }))
  }, [])

  const getDomainDraft = React.useCallback(
    (pluginId: string) => domainDrafts[pluginId] ?? EMPTY_DOMAIN_DRAFT,
    [domainDrafts]
  )

  return { domainDrafts, updateDomainDraft, clearDomainDraft, getDomainDraft }
}
