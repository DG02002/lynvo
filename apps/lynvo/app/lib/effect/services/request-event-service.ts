import { Context } from "effect"
import type { RequestContextFields } from "../../../../workers/request-logging"

export interface RequestEventServiceContract {
  readonly requestId: string
  readonly add: (fields: RequestContextFields) => void
}

export class RequestEventService extends Context.Service<
  RequestEventService,
  RequestEventServiceContract
>()("app/effect/services/RequestEventService") {}
