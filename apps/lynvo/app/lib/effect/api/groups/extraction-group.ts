import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import {
  ExtractionApiError,
  ValidationApiError,
  UnauthorizedApiError,
  BackendApiError,
  UsageLimitApiError,
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
      error: [
        ExtractionApiError,
        ValidationApiError,
        UnauthorizedApiError,
        UsageLimitApiError,
      ],
    }),
    HttpApiEndpoint.get("getMetadata", "/meta", {
      query: Schema.Struct({
        url: Schema.String,
        pluginServerId: Schema.optional(Schema.String),
        pluginId: Schema.optional(Schema.String),
      }),
      success: Schema.Unknown,
      error: [ValidationApiError, BackendApiError],
    })
  )
  .prefix("/api") {}
