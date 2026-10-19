import { createSession } from "../../workers/d1/sessions"
import { insertGoogleUser } from "../../workers/d1/users"

export const createUserFactory =
  (database: D1Database, now: number, email: () => string) => async () =>
    insertGoogleUser(database, {
      googleSubject: `subject-${crypto.randomUUID()}`,
      email: email(),
      now,
    })

const createSessionFor = (
  database: D1Database,
  userId: string,
  now = Date.now()
) => createSession(database, { userId, now })

export const createSessionForFactory =
  (database: D1Database, now: () => number = () => Date.now()) =>
  async (userId: string) =>
    createSessionFor(database, userId, now())
