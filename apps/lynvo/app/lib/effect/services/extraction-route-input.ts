import { Effect } from "effect"

import { extractHttpBasicCredential } from "~/lib/plugins/http-basic-credential"
import { isSafeUrl } from "~/lib/ssrf"

import { ValidationError } from "../errors"

export const prepareExtractionRouteInput = Effect.fn(
  "prepareExtractionRouteInput"
)(function* (sourceUrl: string) {
  const input = yield* Effect.try({
    try: () => extractHttpBasicCredential(sourceUrl),
    catch: () => new ValidationError({ message: "Invalid or unsafe URL" }),
  })
  if (!isSafeUrl(input.url)) {
    return yield* new ValidationError({ message: "Invalid or unsafe URL" })
  }
  return { targetUrl: input.url, basicAuth: input.basicAuth }
})
