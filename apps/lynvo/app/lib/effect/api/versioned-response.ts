import { Schema } from "effect"
import { HttpApiSchema } from "effect/unstable/httpapi"
import { DATA_VERSION_RESPONSE_HEADER } from "../../constants"
import { VersionedMutationResultSchema } from "../../api-contracts"

const dataVersionHeaders = {
  [DATA_VERSION_RESPONSE_HEADER]: Schema.Number,
}

export const withDataVersionResponseSchema = <S extends Schema.Top>(
  schema: S
) => HttpApiSchema.WithHeaders(schema, dataVersionHeaders)

export const VersionedMutationResponseSchema = withDataVersionResponseSchema(
  VersionedMutationResultSchema
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
