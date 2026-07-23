import { z } from "zod"

export const remoteDeviceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
})

export const remotePollResponseSchema = z.object({
  controlledBy: z.string().min(1).nullable().optional(),
  controllerName: z.string().optional(),
  controllingDevices: z.array(remoteDeviceSchema).optional(),
  activeTargets: z.array(z.string().min(1)).optional(),
})

export const remoteRealtimeEventSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("command"),
    id: z.string().min(1),
    command: z.string().min(1),
    payload: z.unknown().optional(),
    createdAt: z.number(),
    targetSessionId: z.string().min(1),
  }),
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
