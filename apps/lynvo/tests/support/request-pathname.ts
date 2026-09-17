import { requestUrl } from "./request-inspection"

export const requestPathname = (request: RequestInfo | URL): string =>
  new URL(requestUrl(request), window.location.origin).pathname
