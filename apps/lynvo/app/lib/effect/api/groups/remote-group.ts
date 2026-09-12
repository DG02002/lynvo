import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { WebAuth, CsrfMiddleware } from "../middleware"
import {
  UnauthorizedApiError,
  CsrfApiError,
  BackendApiError,
  ValidationApiError,
} from "../../errors"
import {
  RemotePollQuerySchema,
  RemotePollResponseSchema,
  RemoteResultPayloadSchema,
  RemoteSendPayloadSchema,
} from "../../../api-contracts"
import {
  VersionedMutationResponseSchema,
  withDataVersionResponseSchema,
} from "../versioned-response"

export class RemoteGroup extends HttpApiGroup.make("remote")
  .add(
    HttpApiEndpoint.post("send", "/send", {
      payload: RemoteSendPayloadSchema,
      success: VersionedMutationResponseSchema,
      error: [
        UnauthorizedApiError,
        CsrfApiError,
        ValidationApiError,
        BackendApiError,
      ],
    }),
    HttpApiEndpoint.get("pollInbox", "/inbox", {
      query: RemotePollQuerySchema,
      success: withDataVersionResponseSchema(RemotePollResponseSchema),
      error: [UnauthorizedApiError, BackendApiError],
    }),
    HttpApiEndpoint.post("reportResult", "/result", {
      payload: RemoteResultPayloadSchema,
      success: VersionedMutationResponseSchema,
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    })
  )
  .middleware(WebAuth)
  .middleware(CsrfMiddleware)
  .prefix("/api/remote") {}
