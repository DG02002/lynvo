import { Schema } from "effect"

import { dataChangedRequestSchema } from "../../shared/realtime-messages"

export interface DataChangedDelivery {
  readonly userId: string
  readonly version: number
}

export const createDataChangedRecorder = () => {
  const deliveries: DataChangedDelivery[] = []
  // SAFETY: The owned-write tests use only getByName(...).fetch(...) to record data-changed notifications.
  const realtime = {
    getByName: (userId: string) => ({
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const request =
          input instanceof Request ? input : new Request(input, init)
        const body = Schema.decodeUnknownSync(dataChangedRequestSchema)(
          await request.json()
        )
        deliveries.push({ userId, version: body.version })
        return Response.json({ deliveredSocketCount: 1 })
      },
    }),
  } as DurableObjectNamespace
  return { realtime, deliveries }
}
