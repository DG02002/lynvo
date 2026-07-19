import type { CheerioAPI } from "cheerio"
import type { ExtractedLink } from "~/features/links/types"
import type { PluginIconSource } from "~/lib/plugin-icons"

export interface Plugin {
  id: string
  name: string
  icon: PluginIconSource
  status: "operational" | "maintenance" | "offline"
  descriptionUrl?: string
  requiresAuth: boolean
  credential?: PluginCredentialRequirement
  /**
   * Optional: Custom validation logic for this plugin's links.
   * If not provided, the default validator (head check) is used.
   */
  validate?: (url: string) => Promise<{ valid: boolean; error?: string } | null>
  canHandle: (url: string) => boolean | Promise<boolean>
  getFilename: (
    url: string,
    $: CheerioAPI | null,
    headers?: Headers
  ) => string | null
  extract: (
    url: string,
    password?: string
  ) => Promise<
    ExtractedLink[] | { links: ExtractedLink[]; meta?: Record<string, unknown> }
  >
  /**
   * Optional: Custom fetch implementation for this plugin.
   * Useful for plugins that require specific headers (Range).
   * If not provided, the default scraper fetchUrl will be used.
   */
  fetch?: (
    url: string,
    env?: Env
  ) => Promise<{
    status: number
    headers: Headers
    $: CheerioAPI | null
  }>
}

export interface PluginCredentialRequirement {
  readonly pluginId: string
  readonly kind: "domain-password" | "http-basic"
}
