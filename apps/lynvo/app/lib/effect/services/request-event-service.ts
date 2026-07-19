import { Context } from "effect"

export interface RequestEventServiceShape {
  readonly requestId: string
  readonly add: (fields: Record<string, unknown>) => void
}

export class RequestEventService extends Context.Service<
  RequestEventService,
  RequestEventServiceShape
>()("app/effect/services/RequestEventService") {}
