import { z } from "zod"

export const authSignInResponseSchema = z
  .object({
    tokens: z
      .object({
        token: z.string().min(1),
        refreshToken: z.string().min(1),
      })
      .strict()
      .nullable()
      .optional(),
    redirect: z.string().min(1).optional(),
    started: z.boolean().optional(),
    error: z.string().min(1).optional(),
  })
  .strip()

export type AuthSignInResponse = z.infer<typeof authSignInResponseSchema>
