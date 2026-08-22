import { Effect, Result, Schema } from "effect"
import { client } from "~/lib/effect/api/client"
import { remotePollResponseSchema } from "./schemas"
import { getRemoteReceiverId } from "~/lib/remote-receiver-identity"

const requireReceiverId = () => {
  const receiverId = getRemoteReceiverId()
  if (!receiverId) {
    throw new Error("Remote receiver identity is unavailable")
  }
  return receiverId
}

export const remoteApi: RemoteControlTransport = {
  connect: async () => undefined,
  disconnect: async () => undefined,
  send: async (targetSessionId, intent) => {
    await Effect.runPromise(
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
    const result = await Effect.runPromise(
      client.remote.pollInbox({
        query: { receiverId: requireReceiverId() },
      })
    )
    const parsed = Schema.decodeUnknownResult(remotePollResponseSchema)({
      commands: [...result.commands],
    })
    if (Result.isFailure(parsed)) {
      throw new Error("Invalid remote poll response")
    }
    return parsed.success
  },
  reportResult: async (commandId, claimToken, result, message) => {
    await Effect.runPromise(
      client.remote.reportResult({
        payload: {
          id: commandId,
          claimToken,
          receiverId: requireReceiverId(),
          result,
          message,
        },
      })
    )
  },
}
