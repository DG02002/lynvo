import type { AuditableLogger } from "evlog"
import { evlog, type EvlogHonoOptions } from "evlog/hono"
import type { Context, MiddlewareHandler } from "hono"

interface RequestLoggingVariables {
  log: AuditableLogger
  requestId: string
}

export interface RequestLoggingEnvironment {
  Bindings: Env
  Variables: RequestLoggingVariables
}

const incomingRequestId = (request: Request): string | undefined => {
  const value = request.headers.get("x-request-id")
  return value && /^[a-zA-Z0-9._:-]{1,128}$/.test(value) ? value : undefined
}

export const addRequestContext = (
  context: Context<RequestLoggingEnvironment>,
  fields: Record<string, unknown>
): void => {
  context.get("log")?.set(fields)
}

export const requestLogging = (
  options?: EvlogHonoOptions
): MiddlewareHandler<RequestLoggingEnvironment> => {
  const evlogMiddleware = evlog(options)

  return async (context, next) => {
    const request = context.req.raw
    const requestId = incomingRequestId(request) ?? crypto.randomUUID()
    const cloudflareRay = request.headers.get("cf-ray")

    context.set("requestId", requestId)
    context.header("x-request-id", requestId)

    await evlogMiddleware(context, async () => {
      context.get("log").set({
        environment: import.meta.env.DEV
          ? "development"
          : (context.env.ENVIRONMENT ?? "production"),
        service_version: context.env.SERVICE_VERSION ?? "development",
        commit_hash: context.env.COMMIT_HASH ?? "unknown",
        region: cloudflareRay?.split("-")[1] ?? "unknown",
        instance_id: context.env.CF_VERSION_METADATA?.id ?? "development",
        request_id: requestId,
        host: new URL(request.url).hostname,
        cloudflare_ray: cloudflareRay,
        client_country: request.headers.get("cf-ipcountry") ?? "unknown",
        user_agent: request.headers.get("user-agent"),
        content_length: request.headers.get("content-length"),
      })
      await next()
    })
  }
}
