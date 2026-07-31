export const createContentSecurityPolicy = (
  requestUrl: string,
  isDevelopment: boolean
): string => {
  const developmentSources = isDevelopment
    ? " http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*"
    : ""
  const developmentImageSource = isDevelopment
    ? ` http://${new URL(requestUrl).hostname}:*`
    : ""

  return `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https: http://localhost:* http://127.0.0.1:*${developmentImageSource}; connect-src 'self' https://challenges.cloudflare.com https://*.convex.cloud wss://*.convex.cloud${developmentSources};`
}
