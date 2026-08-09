import { Effect } from "effect"
import { client } from "~/lib/effect/api/client"
import { remotePollResponseSchema } from "./schemas"

export const remoteApi: RemoteControlTransport = {
  connect: async () => undefined,
  disconnect: async () => undefined,
  send: async (targetSessionId, intent) => {
    return await Effect.runPromise(
      client.remote.send({
        payload: {
          target_session_id: targetSessionId,
          command: "play",
          data: intent,
        },
      })
    )
  },
  poll: async () => {
    const result = await Effect.runPromise(client.remote.pollInbox({}))
    const parsed = remotePollResponseSchema.safeParse({
      commands: [...result.commands],
    })
    if (!parsed.success) {
      throw new Error("Invalid remote poll response")
    }
    return parsed.data
  },
  acknowledge: async (commandId) =>
    await Effect.runPromise(
      client.remote.acknowledge({ payload: { id: commandId } })
    ),
}
