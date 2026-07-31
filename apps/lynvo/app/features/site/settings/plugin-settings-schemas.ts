import { z } from "zod"

const PLUGIN_SERVER_URL_MAX_LENGTH = 2_048
const PLUGIN_SERVER_API_KEY_MAX_LENGTH = 4_096

const pluginServerUrlSchema = z
  .string()
  .trim()
  .min(1, "Base URL is required.")
  .pipe(
    z
      .url({ error: "Enter a valid plugin server URL." })
      .max(PLUGIN_SERVER_URL_MAX_LENGTH, "Plugin server URL is too long.")
      .superRefine((value, context) => {
        const url = new URL(value)
        if (url.protocol !== "https:" && url.hostname !== "localhost") {
          context.addIssue({
            code: "custom",
            message: "Plugin server base URL must use HTTPS.",
          })
        }
      })
  )

export const customPluginServerSchema = z.strictObject({
  baseUrl: pluginServerUrlSchema,
  apiKey: z
    .string()
    .max(PLUGIN_SERVER_API_KEY_MAX_LENGTH, "API key is too long."),
})

export type CustomPluginServerFormValues = z.infer<
  typeof customPluginServerSchema
>
