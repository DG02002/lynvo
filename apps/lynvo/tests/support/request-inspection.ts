/**
 * Turn a fetch target into the URL string it names. A `Request` target has no
 * meaningful stringification, so read `.url` instead of coercing it.
 */
export const requestUrl = (request: RequestInfo | URL): string =>
  request instanceof Request ? request.url : String(request)

/**
 * Parse the JSON string body a same-origin API client sent to a stubbed fetch.
 */
export const readJsonInitBody = (init: RequestInit | undefined) => {
  // SAFETY: the same-origin JSON transport always serializes request bodies as JSON strings
  const body = init?.body as string
  return JSON.parse(body)
}
