import { Effect } from "effect"
import { getD1Database } from "../../../workers/d1/db"
import {
  resolveSessionContext,
  type ResolvedSessionContext,
} from "../../../workers/d1/sessions"

export const webRequestFromSource = <Source>(source: Source) =>
  source instanceof Request
    ? Effect.succeed(source)
    : Effect.die(new Error("HTTP server request source is not a Web Request"))

export const resolveOptionalSession = <Source>(
  source: Source,
  environment: Cloudflare.Env
) =>
  Effect.gen(function* () {
    const webRequest = yield* webRequestFromSource(source)
    const database = getD1Database(environment)
    const session: ResolvedSessionContext | null = database
      ? yield* Effect.promise(() =>
          resolveSessionContext(webRequest, database, Date.now())
        )
      : null
    return { webRequest, session }
  })
