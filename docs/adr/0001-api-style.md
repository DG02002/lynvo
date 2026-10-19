# Use Effect HttpApi for new JSON endpoints

Effect HttpApi owns every new JSON endpoint and its payload schemas, session and CSRF middleware, versioned responses, and error-to-status mapping. Existing `/api/data/*` routes migrate incrementally, while Hono remains the edge shell for SSR, WebSocket upgrades, security headers, request logging, rate limits, and redirect or HTML auth flows.

Follow-up: Effect API mutation groups have no in-code rate limit, and no Cloudflare WAF rule covers them. Add a Hono edge limiter for those groups; limiter unavailability returns `503`. The realtime handshake remains fail-open because its limiter protects a latency optimization. This follow-up is resolved in PR 2 commit 8.
