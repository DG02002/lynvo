import { Schema } from "effect"
import { HttpApiSchema } from "effect/unstable/httpapi"

export class ConvexError extends Schema.TaggedError<ConvexError>()(
  "ConvexError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export class ExtractionError extends Schema.TaggedError<ExtractionError>()(
  "ExtractionError",
  {
    message: Schema.String,
    url: Schema.String,
  }
) {}

export class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  {
    message: Schema.String,
    details: Schema.optional(Schema.Unknown),
  }
) {}

export class UnauthorizedError extends Schema.TaggedError<UnauthorizedError>()(
  "UnauthorizedError",
  {
    message: Schema.String,
  }
) {}

export class NotFoundError extends Schema.TaggedError<NotFoundError>()(
  "NotFoundError",
  {
    message: Schema.String,
  }
) {}

export class CsrfError extends Schema.TaggedError<CsrfError>()("CsrfError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class PluginServerRegistrationError extends Schema.TaggedError<PluginServerRegistrationError>()(
  "PluginServerRegistrationError",
  {
    message: Schema.String,
    details: Schema.optional(Schema.Unknown),
  }
) {}

export class CredentialVaultError extends Schema.TaggedError<CredentialVaultError>()(
  "CredentialVaultError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

const publicError = <Tag extends string>(tag: Tag) =>
  Schema.Struct({ _tag: Schema.Literal(tag), message: Schema.String })

export const ConvexApiError = publicError("ConvexError").pipe(
  HttpApiSchema.status(503)
)
export const ExtractionApiError = publicError("ExtractionError").pipe(
  HttpApiSchema.status(422)
)
export const ValidationApiError = publicError("ValidationError").pipe(
  HttpApiSchema.status(400)
)
export const UnauthorizedApiError = publicError("UnauthorizedError").pipe(
  HttpApiSchema.status(401)
)
export const NotFoundApiError = publicError("NotFoundError").pipe(
  HttpApiSchema.status(404)
)
export const CsrfApiError = publicError("CsrfError").pipe(
  HttpApiSchema.status(403)
)
export const PluginServerRegistrationApiError = publicError(
  "PluginServerRegistrationError"
).pipe(HttpApiSchema.status(422))
export const CredentialVaultApiError = publicError("CredentialVaultError").pipe(
  HttpApiSchema.status(503)
)
