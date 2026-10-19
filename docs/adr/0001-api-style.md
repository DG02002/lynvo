# Use Effect HttpApi for new JSON endpoints

Effect HttpApi owns every new JSON endpoint and its payload schemas, session and CSRF middleware, versioned responses, and error-to-status mapping. Existing `/api/data/*` routes migrate incrementally, while Hono remains the edge shell for SSR, WebSocket upgrades, security headers, request logging, rate limits, and redirect or HTML auth flows.

Edge rate limiting: the five Effect API mutation groups are limited in the Hono shell because no Cloudflare WAF rule covers them. The limiter fails closed with `503` when unavailable. The realtime handshake remains fail-open because its limiter protects a latency optimization, not a mutation.
