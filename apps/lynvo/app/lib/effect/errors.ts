import { Schema } from "effect"
import { HttpApiSchema } from "effect/unstable/httpapi"

export class ConvexError extends Schema.TaggedErrorClass<ConvexError>()(
  "ConvexError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export class ExtractionError extends Schema.TaggedErrorClass<ExtractionError>()(
  "ExtractionError",
  {
    message: Schema.String,
    url: Schema.String,
  }
) {}

export class ValidationError extends Schema.TaggedErrorClass<ValidationError>()(
  "ValidationError",
  {
    message: Schema.String,
    details: Schema.optional(Schema.Unknown),
  }
) {}

export class UnauthorizedError extends Schema.TaggedErrorClass<UnauthorizedError>()(
  "UnauthorizedError",
  {
    message: Schema.String,
  }
) {}

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()(
  "NotFoundError",
  {
    message: Schema.String,
  }
) {}

export class CsrfError extends Schema.TaggedErrorClass<CsrfError>()(
  "CsrfError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export class PluginServerRegistrationError extends Schema.TaggedErrorClass<PluginServerRegistrationError>()(
  "PluginServerRegistrationError",
  {
    message: Schema.String,
    details: Schema.optional(Schema.Unknown),
  }
) {}

export class CredentialVaultError extends Schema.TaggedErrorClass<CredentialVaultError>()(
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
