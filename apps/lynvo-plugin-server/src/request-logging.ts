import type { AuditableLogger } from "evlog"
import { evlog, type EvlogHonoOptions } from "evlog/hono"
import type { MiddlewareHandler } from "hono"
import { Result, Schema } from "effect"

interface PluginServerRequestLoggingVariables {
  readonly log: AuditableLogger
}

export interface PluginServerRequestLoggingEnvironment {
  readonly Bindings: LynvoPluginServerBindings
  readonly Variables: PluginServerRequestLoggingVariables
}

const safeCorrelationId = (value: string | undefined): string | undefined =>
  value && /^[a-zA-Z0-9._:-]{1,128}$/.test(value) ? value : undefined

const protocolErrorSchema = Schema.Struct({
  error: Schema.Struct({ code: Schema.String }),
})

const readProtocolErrorCode = async (
  response: Response
): Promise<string | undefined> => {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return undefined
  }
  try {
    const body = await response.clone().json()
    const result = Schema.decodeUnknownResult(protocolErrorSchema)(body)
    return Result.isSuccess(result) ? result.success.error.code : undefined
  } catch {
    return undefined
  }
}

export const pluginServerRequestLogging = (
  options?: EvlogHonoOptions
): MiddlewareHandler<PluginServerRequestLoggingEnvironment> => {
  const callerKeep = options?.keep
  const middleware = evlog({
    ...options,
    redact: true,
    keep: async (context) => {
      if ((context.status ?? 0) >= 400) {
        context.shouldKeep = true
      }
      await callerKeep?.(context)
    },
  })

  return async (context, next) => {
    const startedAt = performance.now()
    const requestId =
      safeCorrelationId(context.req.header("x-request-id")) ??
      crypto.randomUUID()
    const operationId = safeCorrelationId(context.req.header("x-operation-id"))
    const cloudflareRay = context.req.header("cf-ray")
    context.header("x-request-id", requestId)

    await middleware(context, async () => {
      context.get("log").set({
        request_id: requestId,
        operation_id: operationId,
        operation: context.req.path.slice(1) || "root",
        environment: context.env.ENVIRONMENT ?? "production",
        service_version: context.env.SERVICE_VERSION ?? "development",
        commit_hash: context.env.COMMIT_HASH ?? "unknown",
        region: cloudflareRay?.split("-")[1] ?? "unknown",
        instance_id: context.env.CF_VERSION_METADATA?.id ?? "development",
      })
      await next()
      const status = context.res.status
      const errorCode =
        status >= 400 ? await readProtocolErrorCode(context.res) : undefined
      const logger = context.get("log")
      logger.set({
        outcome: status >= 400 ? "failure" : "success",
        status,
        duration_ms: Math.max(0, performance.now() - startedAt),
      })
      if (status >= 400) {
        logger.set({
          retryable: status === 429 || status >= 500,
          failure_stage: "response",
          error_code: errorCode ?? `http_${status}`,
        })
      }
    })
  }
}
