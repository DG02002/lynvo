import type { AuditableLogger } from "evlog"
import { evlog, type EvlogHonoOptions } from "evlog/hono"
import type { Context, MiddlewareHandler } from "hono"
import { z } from "zod"

interface RequestLoggingVariables {
  log: AuditableLogger
  requestId: string
}

export type RequestContextFields = Parameters<AuditableLogger["set"]>[0]

export interface RequestLoggingEnvironment {
  Bindings: Env
  Variables: RequestLoggingVariables
}

const RAW_URL = /https?:\/\/[^\s"']+/gi
const errorResponseSchema = z.object({
  code: z.string().optional(),
  retryable: z.boolean().optional(),
})

const incomingRequestId = (request: Request): string | undefined => {
  const value = request.headers.get("x-request-id")
  return value && /^[a-zA-Z0-9._:-]{1,128}$/.test(value) ? value : undefined
}

const readErrorResponse = async (
  response: Response
): Promise<{ code?: string; retryable?: boolean }> => {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return {}
  }
  try {
    const result = errorResponseSchema.safeParse(await response.clone().json())
    if (!result.success) {
      return {}
    }
    return {
      code: result.data.code,
      retryable: result.data.retryable,
    }
  } catch {
    return {}
  }
}

export const addRequestContext = (
  context: Context<RequestLoggingEnvironment>,
  fields: RequestContextFields
): void => {
  context.get("log")?.set(fields)
}

export const requestLogging = (
  options?: EvlogHonoOptions
): MiddlewareHandler<RequestLoggingEnvironment> => {
  const callerKeep = options?.keep
  const evlogMiddleware = evlog({
    ...options,
    redact: {
      paths: [
        "**.password",
        "**.*_token",
        "**.token",
        "**.*_secret",
        "**.secret",
        "**.metadata",
        "**.title",
        "**.raw_message",
        "**.*_url",
        "**.url",
      ],
      patterns: [RAW_URL],
    },
    keep: async (context) => {
      if (
        (context.status ?? 0) >= 400 ||
        context.context.outcome === "failure" ||
        context.context.error_code !== undefined
      ) {
        context.shouldKeep = true
      }
      await callerKeep?.(context)
    },
  })

  return async (context, next) => {
    const startedAt = performance.now()
    const request = context.req.raw
    const requestId = incomingRequestId(request) ?? crypto.randomUUID()
    const cloudflareRay = request.headers.get("cf-ray")

    context.set("requestId", requestId)
    context.header("x-request-id", requestId)

    await evlogMiddleware(context, async () => {
      context.get("log")?.set({
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
      const status = context.res.status
      const failure = status >= 400 ? await readErrorResponse(context.res) : {}
      const logger = context.get("log")
      logger?.set({
        outcome: status >= 400 ? "failure" : "success",
        status,
        duration_ms: Math.max(0, performance.now() - startedAt),
      })
      if (status >= 400) {
        logger?.set({
          retryable: failure.retryable ?? (status === 429 || status >= 500),
          failure_stage: "response",
          error_code: failure.code ?? `http_${status}`,
        })
      }
    })
  }
}
