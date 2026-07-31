export const createContentSecurityPolicy = (
  requestUrl: string,
  isDevelopment: boolean,
  nonce?: string,
  themeBootstrapHash?: string
): string => {
  const developmentSources = isDevelopment
    ? " http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*"
    : ""
  const developmentImageSource = isDevelopment
    ? ` http://${new URL(requestUrl).hostname}:*`
    : ""
  const scriptPolicy = isDevelopment
    ? "'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com"
    : `'self'${nonce ? ` 'nonce-${nonce}'` : ""}${themeBootstrapHash ? ` 'sha256-${themeBootstrapHash}'` : ""} https://challenges.cloudflare.com`

  return `default-src 'self'; script-src ${scriptPolicy}; frame-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https: http://localhost:* http://127.0.0.1:*${developmentImageSource}; connect-src 'self' https://challenges.cloudflare.com https://*.convex.cloud wss://*.convex.cloud${developmentSources};`
}
