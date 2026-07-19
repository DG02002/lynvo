import type { Context, MiddlewareHandler } from "hono"
import { logger } from "./logger"

export interface RequestEvent extends Record<string, unknown> {
  event: "request_completed"
  service: "lynvo"
  environment: string
  service_version: string
  commit_hash: string
  region: string
  instance_id: string
  request_id: string
  timestamp: string
  method: string
  path: string
}

interface RequestLoggingVariables {
  requestEvent: RequestEvent
}

export interface RequestLoggingEnvironment {
  Bindings: Env
  Variables: RequestLoggingVariables
}

const serializeError = (error: unknown): Record<string, string> => ({
  type: error instanceof Error ? error.name : "UnknownError",
  message: error instanceof Error ? error.message : String(error),
})

const emitRequestEvent = (event: RequestEvent): void => {
  if (event.outcome === "server_error") {
    logger.error(event)
    return
  }
  logger.info(event)
}

const incomingRequestId = (request: Request): string | undefined => {
  const value = request.headers.get("x-request-id")
  return value && /^[a-zA-Z0-9._:-]{1,128}$/.test(value) ? value : undefined
}

export const addRequestContext = (
  context: Context<RequestLoggingEnvironment>,
  fields: Record<string, unknown>
): void => {
  Object.assign(context.get("requestEvent"), fields)
}

export const requestLogging =
  (): MiddlewareHandler<RequestLoggingEnvironment> => async (context, next) => {
    const startedAt = Date.now()
    const request = context.req.raw
    const requestId = incomingRequestId(request) ?? crypto.randomUUID()
    const cloudflareRay = request.headers.get("cf-ray")
    const event: RequestEvent = {
      event: "request_completed",
      service: "lynvo",
      environment: import.meta.env.DEV
        ? "development"
        : (context.env.ENVIRONMENT ?? "production"),
      service_version: context.env.SERVICE_VERSION ?? "development",
      commit_hash: context.env.COMMIT_HASH ?? "unknown",
      region: cloudflareRay?.split("-")[1] ?? "unknown",
      instance_id: context.env.CF_VERSION_METADATA?.id ?? "development",
      request_id: requestId,
      timestamp: new Date().toISOString(),
      method: request.method,
      path: new URL(request.url).pathname,
      host: new URL(request.url).hostname,
      cloudflare_ray: cloudflareRay,
      client_country: request.headers.get("cf-ipcountry") ?? "unknown",
      user_agent: request.headers.get("user-agent"),
      content_length: request.headers.get("content-length"),
    }
    context.set("requestEvent", event)
    context.header("x-request-id", requestId)

    try {
      await next()
      event.status_code = context.res.status
      event.outcome =
        context.res.status >= 500
          ? "server_error"
          : context.res.status >= 400
            ? "client_error"
            : "success"
    } catch (error) {
      event.status_code = 500
      event.outcome = "server_error"
      event.error = serializeError(error)
      throw error
    } finally {
      event.duration_ms = Date.now() - startedAt
      emitRequestEvent(event)
    }
  }
