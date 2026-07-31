import { defineApp } from "convex/server"
import { v } from "convex/values"
import migrations from "@convex-dev/migrations/convex.config"

const app = defineApp({
  env: {
    AUTH_GATEWAY_SECRET: v.optional(v.string()),
    DISABLE_USAGE_LIMITS: v.optional(v.string()),
  },
})

app.use(migrations)

export default app
