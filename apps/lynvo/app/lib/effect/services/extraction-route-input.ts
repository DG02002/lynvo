import { Effect } from "effect"

import { extractHttpBasicCredential } from "~/lib/plugins/http-basic-credential"
import { isSafeUrl } from "~/lib/ssrf"

import { UNSUPPORTED_URL_CODE } from "../../extraction/errors"
import { ValidationError } from "../errors"

const invalidUrlError = () =>
  new ValidationError({
    message: "Invalid or unsafe URL",
    details: { code: UNSUPPORTED_URL_CODE },
  })

export const prepareExtractionRouteInput = Effect.fn(
  "prepareExtractionRouteInput"
)(function* (sourceUrl: string) {
  const input = yield* Effect.try({
    try: () => extractHttpBasicCredential(sourceUrl),
    catch: invalidUrlError,
  })
  if (!isSafeUrl(input.url)) {
    return yield* invalidUrlError()
  }
  return { targetUrl: input.url, basicAuth: input.basicAuth }
})
