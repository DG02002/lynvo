import { csrfCookie } from "../../app/lib/csrf"
import { D1_SESSION_COOKIE_NAME } from "../../workers/constants"
import { USER_COLUMNS } from "../../workers/d1/rows"
import { createFakeD1Database, type FakeD1QueryHandler } from "./fake-d1"

const DEFAULT_USER_ID = "user-1"
const DEFAULT_SESSION_ID = "session-1"
const DEFAULT_EMAIL = "user@example.com"
const USER_BY_ID_QUERY = `SELECT ${USER_COLUMNS} FROM users WHERE id = ?1`

const isAuthenticatedSessionQuery = (sql: string): boolean =>
  sql.includes("SELECT s.id AS session_id") &&
  sql.includes("FROM sessions s INNER JOIN users u") &&
  sql.includes("WHERE s.id = ?1 AND s.revoked_at IS NULL")

interface AuthenticatedWorkerDatabaseOptions {
  readonly handler?: FakeD1QueryHandler
  readonly userId?: string
  readonly sessionId?: string
  readonly email?: string
}

export const createAuthenticatedWorkerDatabase = ({
  handler,
  userId = DEFAULT_USER_ID,
  sessionId = DEFAULT_SESSION_ID,
  email = DEFAULT_EMAIL,
}: AuthenticatedWorkerDatabaseOptions = {}): D1Database =>
  createFakeD1Database((sql, args) => {
    const customOutcome = handler?.(sql, args)
    if (customOutcome !== undefined) {
      return customOutcome
    }
    if (isAuthenticatedSessionQuery(sql)) {
      return {
        row: {
          session_id: sessionId,
          user_id: userId,
          email,
          last_seen_at: Date.now(),
          expires_at: Date.now() + 60_000,
        },
      }
    }
    if (sql === USER_BY_ID_QUERY) {
      return {
        row: {
          id: userId,
          google_subject: "google-subject",
          email,
          display_name: null,
          avatar_url: null,
          data_version: 1,
          erasure_pending_at: null,
          storage_retention_days: 30,
          range_supported_player_id: null,
          range_unsupported_player_id: null,
          created_at: Date.now(),
        },
      }
    }
    return undefined
  })

interface AuthenticatedWorkerRequestOptions {
  readonly method?: "DELETE" | "GET" | "PATCH" | "POST"
  readonly body?: unknown
  readonly headers?: HeadersInit
  readonly csrfToken?: string
  readonly sessionCookieValue?: string
  readonly userId?: string
  readonly sessionId?: string
}

export const buildAuthenticatedWorkerRequest = async (
  path: string,
  {
    method = "GET",
    body,
    headers: additionalHeaders,
    csrfToken = "test-csrf-token",
    sessionCookieValue = DEFAULT_SESSION_ID,
    userId = DEFAULT_USER_ID,
    sessionId = DEFAULT_SESSION_ID,
  }: AuthenticatedWorkerRequestOptions = {}
): Promise<Request> => {
  const csrfCookieHeader = await csrfCookie.serialize(csrfToken)
  const headers = new Headers({
    Accept: "application/json",
    Cookie: `${D1_SESSION_COOKIE_NAME}=${sessionCookieValue}; ${csrfCookieHeader}`,
    Origin: "https://lynvo.test",
    "X-CSRF-Token": csrfToken,
    "X-Lynvo-Expected-User-Id": userId,
    "X-Lynvo-Expected-Session-Id": sessionId,
    ...additionalHeaders,
  })
  if (body !== undefined) {
    headers.set("Content-Type", "application/json")
  }
  return new Request(
    path.startsWith("http") ? path : `https://lynvo.test${path}`,
    {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }
  )
}

interface TestRealtimeRoomNamespace {
  readonly getByName: (userId: string) => {
    readonly fetch: (url: string, init?: RequestInit) => Promise<Response>
  }
}

interface WorkerTestEnvironment {
  readonly ENVIRONMENT: "development" | "production"
  DB?: D1Database
  USER_REALTIME_ROOM?: TestRealtimeRoomNamespace
}

export const createWorkerEnvironment = ({
  database,
  userRealtimeRoom,
  environment,
}: {
  readonly database?: D1Database
  readonly userRealtimeRoom?: TestRealtimeRoomNamespace
  readonly environment: "development" | "production"
}): Env => {
  const testEnvironment: WorkerTestEnvironment = {
    ENVIRONMENT: environment,
  }
  if (database) {
    testEnvironment.DB = database
  }
  if (userRealtimeRoom) {
    testEnvironment.USER_REALTIME_ROOM = userRealtimeRoom
  }
  // SAFETY: Focused Worker tests provide only the bindings used by their route.
  return testEnvironment as Env
}

export const createWorkerExecutionContext = (): ExecutionContext => {
  // SAFETY: The Worker only calls waitUntil on this execution context.
  return { waitUntil: () => undefined } as ExecutionContext
}
