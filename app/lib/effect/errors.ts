import { Schema } from "effect"

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

export class WorkerRegistrationError extends Schema.TaggedErrorClass<WorkerRegistrationError>()(
  "WorkerRegistrationError",
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
