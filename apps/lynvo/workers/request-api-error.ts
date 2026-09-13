import type { Context as HonoContext } from "hono"
import { createApiErrorResponse } from "../app/lib/api-errors"
import type { RequestLoggingEnvironment } from "./request-logging"

export const requestApiError = (
  context: HonoContext<RequestLoggingEnvironment>,
  error: Parameters<typeof createApiErrorResponse>[0]
) =>
  createApiErrorResponse({
    ...error,
    requestId: context.get("requestId"),
  })
