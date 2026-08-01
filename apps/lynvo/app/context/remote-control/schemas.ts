import { z } from "zod"
import {
  remoteCommandFieldsSchema,
  remoteCommandWirePayloadSchema,
} from "~/lib/remote-play/wire"

export const remoteDeviceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
})

export const remotePollResponseSchema = z.object({
  controlledBy: z.string().min(1).nullable().optional(),
  controllerName: z.string().optional(),
  controllingDevices: z.array(remoteDeviceSchema).optional(),
  activeTargets: z.array(z.string().min(1)).optional(),
  commands: z.array(remoteCommandFieldsSchema).optional(),
})

export const remoteRealtimeEventSchema = z.discriminatedUnion("kind", [
  remoteCommandWirePayloadSchema,
  z.object({
    kind: z.literal("connections"),
    controllingDevices: z.array(remoteDeviceSchema),
  }),
  z.object({
    kind: z.literal("targets"),
    activeTargets: z.array(z.string().min(1)),
  }),
])

export type ValidRemotePollResponse = z.infer<typeof remotePollResponseSchema>
export type ValidRemoteRealtimeEvent = z.infer<typeof remoteRealtimeEventSchema>
