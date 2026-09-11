import { Result, Schema } from "effect"
import type { MiddlewareHandler } from "hono"
import { VersionedMutationBodySchema } from "../../app/lib/api-contracts"
import { DATA_VERSION_RESPONSE_HEADER } from "../constants"
import type { RequestLoggingEnvironment } from "../request-logging"
import { getD1Database } from "./db"
import { getDataVersion } from "./data-version"
import { resolveD1Session } from "./sessions"

const readBodyDataVersion = async (
  response: Response
): Promise<number | undefined> => {
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => null)
  const decoded = Schema.decodeUnknownResult(VersionedMutationBodySchema)(body)
  return Result.isSuccess(decoded) ? decoded.success.dataVersion : undefined
}

export const echoDataVersion =
  (): MiddlewareHandler<RequestLoggingEnvironment> => async (context, next) => {
    await next()
    // Handlers that read or write items and version atomically set the
    // header themselves; re-reading here would race concurrent writes.
    if (context.res.headers.has(DATA_VERSION_RESPONSE_HEADER)) {
      return
    }
    let dataVersion: number | undefined
    if (context.req.method !== "GET") {
      dataVersion = await readBodyDataVersion(context.res)
    } else {
      const database = getD1Database(context.env)
      if (!database) {
        return
      }
      const session = await resolveD1Session(context.req.raw, database)
      if (!session) {
        return
      }
      dataVersion = await getDataVersion(database, session.userId)
    }
    if (dataVersion === undefined) {
      return
    }
    const response = context.res
    context.res = new Response(response.body, response)
    context.res.headers.set(DATA_VERSION_RESPONSE_HEADER, String(dataVersion))
  }
