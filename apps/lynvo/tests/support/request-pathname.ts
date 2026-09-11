export const requestPathname = (request: RequestInfo | URL): string =>
  new URL(
    request instanceof Request ? request.url : String(request),
    window.location.origin
  ).pathname
