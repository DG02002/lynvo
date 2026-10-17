import { Schema } from "effect"
import { HttpApiSchema } from "effect/http-api"

import { VersionedMutationBodySchema } from "../../api-contracts"
import { DATA_VERSION_RESPONSE_HEADER } from "../../constants"

const dataVersionHeaders = {
  [DATA_VERSION_RESPONSE_HEADER]: Schema.Number,
}

export const withDataVersionResponseSchema = <S extends Schema.Top>(
  schema: S
): HttpApiSchema.WithHeaders<S, Schema.Struct<typeof dataVersionHeaders>> =>
  HttpApiSchema.WithHeaders(schema, dataVersionHeaders)

export const VersionedMutationResponseSchema = withDataVersionResponseSchema(
  VersionedMutationBodySchema
)

export const withDataVersionHeaders = <
  Body extends { readonly dataVersion: number },
>(
  body: Body
): HttpApiSchema.withHeaders<
  Body,
  { readonly [DATA_VERSION_RESPONSE_HEADER]: number }
> =>
  HttpApiSchema.withHeaders({
    body,
    headers: { [DATA_VERSION_RESPONSE_HEADER]: body.dataVersion },
  })

export const versionedSuccess = (dataVersion: number) =>
  withDataVersionHeaders({ success: true, dataVersion })
