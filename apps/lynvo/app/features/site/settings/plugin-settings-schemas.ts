import { Schema } from "effect"

const PLUGIN_SERVER_URL_MAX_LENGTH = 2_048
const PLUGIN_SERVER_API_KEY_MAX_LENGTH = 4_096

const pluginServerUrlSchema = Schema.Trim.pipe(
  Schema.check(Schema.isMinLength(1, { message: "Base URL is required." })),
  Schema.check(
    Schema.isMaxLength(PLUGIN_SERVER_URL_MAX_LENGTH, {
      message: "Plugin server URL is too long.",
    })
  ),
  Schema.refine(
    (value): value is string => {
      if (value.length === 0) {
        return true
      }
      try {
        const url = new URL(value)
        return url.protocol === "https:" || url.hostname === "localhost"
      } catch {
        return false
      }
    },
    { message: "Plugin server base URL must use HTTPS." }
  )
)

export const customPluginServerSchema = Schema.Struct({
  baseUrl: pluginServerUrlSchema,
  apiKey: Schema.String.pipe(
    Schema.check(
      Schema.isMaxLength(PLUGIN_SERVER_API_KEY_MAX_LENGTH, {
        message: "API key is too long.",
      })
    )
  ),
})

export const customPluginServerStandardSchema = Schema.toStandardSchemaV1(
  customPluginServerSchema
)

export type CustomPluginServerFormValues = typeof customPluginServerSchema.Type
