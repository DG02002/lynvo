/** Read a fetch target's URL without stringifying a Request. */
export const requestUrl = (request: RequestInfo | URL): string =>
  request instanceof Request ? request.url : String(request)

/** Parse a JSON string body from a stubbed same-origin fetch. */
export const readJsonInitBody = (init: RequestInit | undefined) => {
  const body = init?.body
  if (body === null || body === undefined) {
    throw new Error("Expected a JSON string fetch body")
  }
  // SAFETY: the same-origin JSON transport always sends a serialized string body.
  const jsonBody = body as string
  return JSON.parse(jsonBody)
}
