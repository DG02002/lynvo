import { Schema } from "effect"
import { HttpApiSchema } from "effect/unstable/httpapi"
import { DATA_VERSION_RESPONSE_HEADER } from "../../constants"
import { VersionedMutationBodySchema } from "../../api-contracts"

const dataVersionHeaders = {
  [DATA_VERSION_RESPONSE_HEADER]: Schema.Number,
}

export const withDataVersionResponseSchema = <S extends Schema.Top>(
  schema: S
) => HttpApiSchema.WithHeaders(schema, dataVersionHeaders)

export const VersionedMutationResponseSchema = withDataVersionResponseSchema(
  VersionedMutationBodySchema
)

export const withDataVersionHeaders = <
  Body extends { readonly dataVersion: number },
>(
  body: Body
) =>
  HttpApiSchema.withHeaders({
    body,
    headers: { [DATA_VERSION_RESPONSE_HEADER]: body.dataVersion },
  })

export const versionedSuccess = (dataVersion: number) =>
  withDataVersionHeaders({ success: true, dataVersion })
