import { Effect } from "effect"
import { client } from "~/lib/effect/api/client"

export const remoteApi: RemoteControlTransport = {
  connect: async () => undefined,
  disconnect: async () => undefined,
  send: async (targetSessionId, command, data) => {
    if (command !== "play" && command !== "pause") {
      throw new Error("Unsupported remote command")
    }
    return await Effect.runPromise(
      client.remote.send({
        payload: {
          target_session_id: targetSessionId,
          command,
          data,
        },
      })
    )
  },
  poll: async () => {
    const result = await Effect.runPromise(client.remote.pollInbox({}))
    return { commands: [...result.commands] }
  },
  acknowledge: async (commandId) =>
    await Effect.runPromise(
      client.remote.acknowledge({ payload: { id: commandId } })
    ),
}
