import { z } from "zod"
import { parseRemotePlaybackIntent } from "~/features/links/playable-link-handoff"

declare global {
  interface RemoteCommandWireFields {
    id: string
    command: "play"
    payload: string
    createdAt: number
  }

  interface RemoteCommandWirePayload extends RemoteCommandWireFields {
    kind: "command"
    targetSessionId: string
  }

  interface RemoteCommandWireMessage {
    type: "remote.event"
    payload: RemoteCommandWirePayload
  }
}

export const remoteCommandFieldsSchema = z.object({
  id: z.string().min(1),
  command: z.literal("play"),
  payload: z.string().superRefine((payload, context) => {
    try {
      const parsed = parseRemotePlaybackIntent(JSON.parse(payload))
      if (parsed.success) {
        return
      }
    } catch {
      context.addIssue({ code: "custom", message: "Invalid playback intent" })
      return
    }
    context.addIssue({ code: "custom", message: "Invalid playback intent" })
  }),
  createdAt: z.number().nonnegative().finite(),
})

export const remoteCommandWirePayloadSchema = remoteCommandFieldsSchema.extend({
  kind: z.literal("command"),
  targetSessionId: z.string().min(1),
})

export const remoteCommandWireMessageSchema = z.object({
  type: z.literal("remote.event"),
  payload: remoteCommandWirePayloadSchema,
})

export const createRemoteCommandMessage = (
  payload: Omit<RemoteCommandWirePayload, "kind">
): RemoteCommandWireMessage => ({
  type: "remote.event",
  payload: { kind: "command", ...payload },
})
