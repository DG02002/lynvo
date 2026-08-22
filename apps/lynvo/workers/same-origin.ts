export const isSameOriginRequest = (request: Request): boolean => {
  const origin = request.headers.get("Origin")
  return !origin || origin === new URL(request.url).origin
}
