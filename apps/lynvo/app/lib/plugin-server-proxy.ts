export const SCRAPE_DO_PROXY_PROVIDER = "scrape-do" as const

export type SupportedProxyProvider = typeof SCRAPE_DO_PROXY_PROVIDER

export const isProxyTokenRemoval = (token: string): boolean =>
  token.trim() === ""

export const isSupportedProxyProvider = (
  provider: string | undefined
): provider is SupportedProxyProvider => provider === SCRAPE_DO_PROXY_PROVIDER
