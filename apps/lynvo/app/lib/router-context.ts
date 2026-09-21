import type { ExecutionContext as HonoExecutionContext } from "hono"
import { createContext } from "react-router"

export type CloudflareRouterContext = {
  env: Env
  ctx: HonoExecutionContext
}

export const cloudflareContext = createContext<CloudflareRouterContext>()
