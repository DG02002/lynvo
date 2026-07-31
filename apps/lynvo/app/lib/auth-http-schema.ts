import { z } from "zod"

export const authSignInResponseSchema = z.object({
  signingIn: z.boolean().optional(),
  tokens: z
    .strictObject({
      token: z.string().min(1),
      refreshToken: z.string().min(1),
    })
    .nullable()
    .optional(),
  redirect: z.string().min(1).optional(),
  started: z.boolean().optional(),
})

export type AuthSignInResponse = z.infer<typeof authSignInResponseSchema>
