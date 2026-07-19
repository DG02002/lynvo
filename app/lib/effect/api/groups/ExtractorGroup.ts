import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import {
  ExtractionError,
  ValidationError,
  UnauthorizedError,
  ConvexError,
} from "../../errors"

export class ExtractorGroup extends HttpApiGroup.make("extractor")
  .add(
    HttpApiEndpoint.get("extract", "/extract", {
      query: Schema.Struct({
        url: Schema.String,
        workerId: Schema.optional(Schema.String),
        kind: Schema.optional(Schema.String),
      }),
      success: Schema.Unknown,
      error: [ExtractionError, ValidationError, UnauthorizedError],
    }),
    HttpApiEndpoint.get("getMetadata", "/meta", {
      query: Schema.Struct({
        url: Schema.String,
      }),
      success: Schema.Unknown,
      error: [ValidationError, ConvexError],
    })
  )
  .prefix("/api") {}
