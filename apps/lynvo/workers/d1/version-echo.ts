import type { MiddlewareHandler } from "hono"
import { DATA_VERSION_RESPONSE_HEADER } from "../constants"
import type { RequestLoggingEnvironment } from "../request-logging"
import { getD1Database } from "./db"
import { getDataVersion } from "./data-version"
import { resolveD1Session } from "./sessions"

export const echoDataVersion =
  (): MiddlewareHandler<RequestLoggingEnvironment> => async (context, next) => {
    await next()
    if (context.req.method !== "GET") {
      return
    }
    const database = getD1Database(context.env)
    if (!database) {
      return
    }
    const session = await resolveD1Session(context.req.raw, database)
    if (!session) {
      return
    }
    const dataVersion = await getDataVersion(database, session.userId)
    const response = context.res
    context.res = new Response(response.body, response)
    context.res.headers.set(DATA_VERSION_RESPONSE_HEADER, String(dataVersion))
  }
