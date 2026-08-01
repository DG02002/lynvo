import { z } from "zod"

declare global {
  interface RemoteCommandWireFields {
    id: string
    command: "play" | "pause"
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
  command: z.enum(["play", "pause"]),
  payload: z.string(),
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
