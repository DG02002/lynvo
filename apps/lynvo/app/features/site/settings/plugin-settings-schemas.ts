import { z } from "zod"

const WORKER_URL_MAX_LENGTH = 2_048
const WORKER_API_KEY_MAX_LENGTH = 4_096

const workerUrlSchema = z
  .string()
  .trim()
  .min(1, "Base URL is required.")
  .pipe(
    z
      .url({ error: "Enter a valid worker URL." })
      .max(WORKER_URL_MAX_LENGTH, "Worker URL is too long.")
      .superRefine((value, context) => {
        const url = new URL(value)
        if (url.protocol !== "https:" && url.hostname !== "localhost") {
          context.addIssue({
            code: "custom",
            message: "Worker base URL must use HTTPS.",
          })
        }
      })
  )

export const externalWorkerSchema = z
  .object({
    baseUrl: workerUrlSchema,
    apiKey: z.string().max(WORKER_API_KEY_MAX_LENGTH, "API key is too long."),
  })
  .strict()

export type ExternalWorkerFormValues = z.infer<typeof externalWorkerSchema>
