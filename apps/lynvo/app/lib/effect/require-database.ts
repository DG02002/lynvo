import { Effect } from "effect"
import { getD1Database } from "../../../workers/d1/db"
import { BackendError } from "./errors"

export const requireDatabaseEffect = Effect.fn("requireDatabaseEffect")(
  function* (
    environment: Cloudflare.Env,
    message: string
  ): Effect.fn.Return<D1Database, BackendError> {
    const database = getD1Database(environment)
    if (!database) {
      return yield* new BackendError({ message })
    }
    return database
  }
)
