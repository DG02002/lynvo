export const getClientIp = (request: Request): string =>
  request.headers.get("CF-Connecting-IP") ??
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  "unknown"
