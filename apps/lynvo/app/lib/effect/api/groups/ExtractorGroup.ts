import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import {
  ExtractionApiError,
  ValidationApiError,
  UnauthorizedApiError,
  ConvexApiError,
} from "../../errors"

export class ExtractorGroup extends HttpApiGroup.make("extractor")
  .add(
    HttpApiEndpoint.get("extract", "/extract", {
      query: Schema.Struct({
        url: Schema.String,
        workerId: Schema.optional(Schema.String),
        sourceId: Schema.optional(Schema.String),
        kind: Schema.optional(Schema.String),
      }),
      success: Schema.Unknown,
      error: [ExtractionApiError, ValidationApiError, UnauthorizedApiError],
    }),
    HttpApiEndpoint.get("getMetadata", "/meta", {
      query: Schema.Struct({
        url: Schema.String,
      }),
      success: Schema.Unknown,
      error: [ValidationApiError, ConvexApiError],
    })
  )
  .prefix("/api") {}
