import { defineApp } from "convex/server"
import { v } from "convex/values"

const app = defineApp({
  env: {
    AUTH_GATEWAY_SECRET: v.optional(v.string()),
  },
})

export default app
