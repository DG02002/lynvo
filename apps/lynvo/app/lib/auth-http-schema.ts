import { z } from "zod"

export const authSignInResponseSchema = z
  .object({
    signingIn: z.boolean().optional(),
    redirect: z.string().min(1).optional(),
    started: z.boolean().optional(),
  })
  .strict()

export type AuthSignInResponse = z.infer<typeof authSignInResponseSchema>
