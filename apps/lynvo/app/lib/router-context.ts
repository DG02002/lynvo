import { createContext } from "react-router"
import type { ExecutionContext as HonoExecutionContext } from "hono"

export type CloudflareRouterContext = {
  env: Env
  ctx: HonoExecutionContext
}

export const cloudflareContext = createContext<CloudflareRouterContext>()
