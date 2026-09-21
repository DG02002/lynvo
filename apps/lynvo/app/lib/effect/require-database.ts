import { Effect } from "effect"

import { getD1Database } from "../../../workers/d1/db"
import { BackendError } from "./errors"

export const ACCOUNT_DATA_UNAVAILABLE_MESSAGE =
  "Account data is temporarily unavailable"

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

export const requireDatabaseEffectAs = <ErrorType>(
  environment: Cloudflare.Env,
  createError: (error: BackendError) => ErrorType,
  message = ACCOUNT_DATA_UNAVAILABLE_MESSAGE
): Effect.Effect<D1Database, ErrorType> =>
  requireDatabaseEffect(environment, message).pipe(Effect.mapError(createError))
