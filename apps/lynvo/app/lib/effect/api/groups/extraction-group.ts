import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"

import { ExtractQuerySchema, MetadataQuerySchema } from "../../../api-contracts"
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
      query: ExtractQuerySchema,
      headers: Schema.Struct({
        "x-request-id": Schema.optional(Schema.String),
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
      query: MetadataQuerySchema,
      headers: Schema.Struct({
        "x-request-id": Schema.optional(Schema.String),
      }),
      success: Schema.Unknown,
      error: [ValidationApiError, BackendApiError],
    })
  )
  .prefix("/api") {}
