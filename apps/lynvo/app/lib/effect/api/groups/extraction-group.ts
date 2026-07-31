import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import {
  ExtractionApiError,
  ValidationApiError,
  UnauthorizedApiError,
  ConvexApiError,
} from "../../errors"

export class ExtractionGroup extends HttpApiGroup.make("extraction")
  .add(
    HttpApiEndpoint.get("extract", "/extract", {
      query: Schema.Struct({
        url: Schema.String,
        pluginServerId: Schema.optional(Schema.String),
        pluginId: Schema.optional(Schema.String),
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
