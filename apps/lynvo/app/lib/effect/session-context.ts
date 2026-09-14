import { Effect } from "effect"
import { getD1Database } from "../../../workers/d1/db"
import type { ResolvedSessionContext } from "../../../workers/d1/sessions"
import { resolveSessionContextForEnvironment } from "../../../workers/d1/development-auth"

export const webRequestFromSource = <Source>(source: Source) =>
  source instanceof Request
    ? Effect.succeed(source)
    : Effect.die(new Error("HTTP server request source is not a Web Request"))

export const resolveOptionalSession = (
  webRequest: Request,
  environment: Cloudflare.Env
): Effect.Effect<ResolvedSessionContext | null> => {
  const database = getD1Database(environment)
  return database
    ? Effect.promise(() =>
        resolveSessionContextForEnvironment({
          request: webRequest,
          environment,
          database,
          now: Date.now(),
        })
      )
    : Effect.succeed(null)
}
