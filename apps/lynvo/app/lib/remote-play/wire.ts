import { z } from "zod"

declare global {
  interface RemoteCommandWirePayload {
    kind: "command"
    id: string
    command: "play" | "pause"
    payload: string
    createdAt: number
    targetSessionId: string
  }

  interface RemoteCommandWireMessage {
    type: "remote.event"
    payload: RemoteCommandWirePayload
  }
}

export const remoteCommandWirePayloadSchema = z.object({
  kind: z.literal("command"),
  id: z.string().min(1),
  command: z.enum(["play", "pause"]),
  payload: z.string(),
  createdAt: z.number().nonnegative().finite(),
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
