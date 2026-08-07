import { z } from "zod"

export const authSignInResponseSchema = z.strictObject({
  signingIn: z.boolean().optional(),
  redirect: z.string().min(1).optional(),
  started: z.boolean().optional(),
})

export type AuthSignInResponse = z.infer<typeof authSignInResponseSchema>
