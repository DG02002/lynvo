import { Schema } from "effect"
import { HttpApiSchema } from "effect/unstable/httpapi"

export class ConvexError extends Schema.TaggedErrorClass<ConvexError>()(
  "ConvexError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export class WorkosError extends Schema.TaggedErrorClass<WorkosError>()(
  "WorkosError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export class AuthTransactionError extends Schema.TaggedErrorClass<AuthTransactionError>()(
  "AuthTransactionError",
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

export const ConvexApiError = ConvexError.pipe(HttpApiSchema.status(503))
export const WorkosApiError = WorkosError.pipe(HttpApiSchema.status(502))
export const AuthTransactionApiError = AuthTransactionError.pipe(
  HttpApiSchema.status(503)
)
export const ExtractionApiError = ExtractionError.pipe(
  HttpApiSchema.status(422)
)
export const ValidationApiError = ValidationError.pipe(
  HttpApiSchema.status(400)
)
export const UnauthorizedApiError = UnauthorizedError.pipe(
  HttpApiSchema.status(401)
)
export const NotFoundApiError = NotFoundError.pipe(HttpApiSchema.status(404))
export const CsrfApiError = CsrfError.pipe(HttpApiSchema.status(403))
export const PluginServerRegistrationApiError =
  PluginServerRegistrationError.pipe(HttpApiSchema.status(422))
export const CredentialVaultApiError = CredentialVaultError.pipe(
  HttpApiSchema.status(503)
)
