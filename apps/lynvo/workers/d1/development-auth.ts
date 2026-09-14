import { D1_SESSION_TOTAL_DURATION_MS } from "../constants"
import {
  resolveD1Session,
  resolveSessionContext,
  type ResolvedSessionContext,
  type SessionRecord,
} from "./sessions"

export interface DevelopmentAuthEnvironment {
  readonly ENVIRONMENT?: string
  readonly LYNVO_NO_AUTH?: string | boolean
}

export const DEVELOPMENT_AUTH_USER_ID = "lynvo-development-user"
export const DEVELOPMENT_AUTH_SESSION_ID = "lynvo-development-session"
export const DEVELOPMENT_AUTH_EMAIL = "dev@localhost"
export const DEVELOPMENT_AUTH_DISPLAY_NAME = "Local development user"

const DEVELOPMENT_AUTH_GOOGLE_SUBJECT = "lynvo-development-subject"
const DEVELOPMENT_AUTH_DEVICE_NAME = "Development browser"
const DEVELOPMENT_AUTH_USER_AGENT = "lynvo-dev-no-auth"

const isEnabled = (value: string | boolean | undefined): boolean =>
  value === true || value === "true"

export const isDevelopmentAuthBypassEnabled = (
  environment: DevelopmentAuthEnvironment
): boolean =>
  import.meta.env.DEV &&
  environment.ENVIRONMENT === "development" &&
  (isEnabled(environment.LYNVO_NO_AUTH) || process.env.LYNVO_NO_AUTH === "true")

export interface DevelopmentAuthSession {
  readonly session: SessionRecord
  readonly context: ResolvedSessionContext
}

interface ResolveDevelopmentAuthInput {
  readonly request: Request
  readonly environment: DevelopmentAuthEnvironment
  readonly database: D1Database
  readonly now: number
}

export const getDevelopmentAuthSession = async (
  database: D1Database,
  now: number
): Promise<DevelopmentAuthSession> => {
  const expiresAt = now + D1_SESSION_TOTAL_DURATION_MS

  await database.batch([
    database
      .prepare(
        `INSERT OR IGNORE INTO users (
          id,
          google_subject,
          email,
          display_name,
          avatar_url,
          data_version,
          erasure_pending_at,
          created_at,
          storage_retention_days,
          range_supported_player_id,
          range_unsupported_player_id
        ) VALUES (?1, ?2, ?3, ?4, NULL, 1, NULL, ?5, 30, NULL, NULL)`
      )
      .bind(
        DEVELOPMENT_AUTH_USER_ID,
        DEVELOPMENT_AUTH_GOOGLE_SUBJECT,
        DEVELOPMENT_AUTH_EMAIL,
        DEVELOPMENT_AUTH_DISPLAY_NAME,
        now
      ),
    database
      .prepare(
        `INSERT OR IGNORE INTO sessions (
          id,
          user_id,
          created_at,
          last_seen_at,
          expires_at,
          revoked_at,
          user_agent,
          device_name
        ) VALUES (?1, ?2, ?3, ?3, ?4, NULL, ?5, ?6)`
      )
      .bind(
        DEVELOPMENT_AUTH_SESSION_ID,
        DEVELOPMENT_AUTH_USER_ID,
        now,
        expiresAt,
        DEVELOPMENT_AUTH_USER_AGENT,
        DEVELOPMENT_AUTH_DEVICE_NAME
      ),
    database
      .prepare(
        `UPDATE sessions
         SET user_id = ?2,
             last_seen_at = ?3,
             expires_at = ?4,
             revoked_at = NULL,
             user_agent = ?5,
             device_name = ?6
         WHERE id = ?1`
      )
      .bind(
        DEVELOPMENT_AUTH_SESSION_ID,
        DEVELOPMENT_AUTH_USER_ID,
        now,
        expiresAt,
        DEVELOPMENT_AUTH_USER_AGENT,
        DEVELOPMENT_AUTH_DEVICE_NAME
      ),
  ])

  return {
    session: {
      id: DEVELOPMENT_AUTH_SESSION_ID,
      userId: DEVELOPMENT_AUTH_USER_ID,
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
      revokedAt: null,
      userAgent: DEVELOPMENT_AUTH_USER_AGENT,
      deviceName: DEVELOPMENT_AUTH_DEVICE_NAME,
    },
    context: {
      sessionId: DEVELOPMENT_AUTH_SESSION_ID,
      userId: DEVELOPMENT_AUTH_USER_ID,
      email: DEVELOPMENT_AUTH_EMAIL,
      displayName: DEVELOPMENT_AUTH_DISPLAY_NAME,
      lastSeenAt: now,
      expiresAt,
    },
  }
}

export const resolveSessionContextForEnvironment = async (
  input: ResolveDevelopmentAuthInput
): Promise<ResolvedSessionContext | null> =>
  isDevelopmentAuthBypassEnabled(input.environment)
    ? (await getDevelopmentAuthSession(input.database, input.now)).context
    : resolveSessionContext(input.request, input.database, input.now)

export const resolveD1SessionForEnvironment = async (
  input: ResolveDevelopmentAuthInput
): Promise<SessionRecord | null> =>
  isDevelopmentAuthBypassEnabled(input.environment)
    ? (await getDevelopmentAuthSession(input.database, input.now)).session
    : resolveD1Session(input.request, input.database)
