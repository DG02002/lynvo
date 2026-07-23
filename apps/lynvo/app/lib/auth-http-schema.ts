import { z } from "zod"

export const authSignInResponseSchema = z.object({
  tokens: z
    .strictObject({
      token: z.string().min(1),
      refreshToken: z.string().min(1),
    })
    .nullable()
    .optional(),
  redirect: z.string().min(1).optional(),
  started: z.boolean().optional(),
  error: z.string().min(1).optional(),
})

export type AuthSignInResponse = z.infer<typeof authSignInResponseSchema>
