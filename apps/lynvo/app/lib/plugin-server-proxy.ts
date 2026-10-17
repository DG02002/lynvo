export const SCRAPE_DO_PROXY_PROVIDER = "scrape-do" as const

export type SupportedProxyProvider = typeof SCRAPE_DO_PROXY_PROVIDER

export const isProxyTokenRemoval = (token: string): boolean =>
  token.trim() === ""

export const isSupportedProxyProvider = (
  provider: string | undefined
): provider is SupportedProxyProvider => provider === SCRAPE_DO_PROXY_PROVIDER

export interface ProxyProviderPresentation {
  readonly name: string
  readonly description: string
  /** Monogram shown in the provider mark; providers have no bundled logo. */
  readonly monogram: string
  /** Tailwind classes tinting the provider mark. */
  readonly markClassName: string
}

const PROXY_PROVIDER_PRESENTATIONS = {
  [SCRAPE_DO_PROXY_PROVIDER]: {
    name: "Scrape.do",
    description: "Web scraping proxy with monthly request credits",
    monogram: "Sd",
    markClassName: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
} satisfies Record<SupportedProxyProvider, ProxyProviderPresentation>

export const getProxyProviderPresentation = (
  provider: string | undefined
): ProxyProviderPresentation | undefined =>
  isSupportedProxyProvider(provider)
    ? PROXY_PROVIDER_PRESENTATIONS[provider]
    : undefined
