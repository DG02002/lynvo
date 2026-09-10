import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { WebAuth, CsrfMiddleware } from "../middleware"
import {
  UnauthorizedApiError,
  CsrfApiError,
  BackendApiError,
} from "../../errors"
import {
  MutationResultSchema,
  RemotePollQuerySchema,
  RemotePollResponseSchema,
  RemoteResultPayloadSchema,
  RemoteSendPayloadSchema,
} from "../../../api-contracts"

export class RemoteGroup extends HttpApiGroup.make("remote")
  .add(
    HttpApiEndpoint.post("send", "/send", {
      payload: RemoteSendPayloadSchema,
      success: MutationResultSchema,
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    }),
    HttpApiEndpoint.get("pollInbox", "/inbox", {
      query: RemotePollQuerySchema,
      success: RemotePollResponseSchema,
      error: [UnauthorizedApiError, BackendApiError],
    }),
    HttpApiEndpoint.post("reportResult", "/result", {
      payload: RemoteResultPayloadSchema,
      success: MutationResultSchema,
      error: [UnauthorizedApiError, CsrfApiError, BackendApiError],
    })
  )
  .middleware(WebAuth)
  .middleware(CsrfMiddleware)
  .prefix("/api/remote") {}
