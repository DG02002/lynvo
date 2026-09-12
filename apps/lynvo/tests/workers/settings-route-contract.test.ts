import { describe, expect, it } from "vitest"
import app from "../../workers/app"
import {
  buildAuthenticatedWorkerRequest,
  createAuthenticatedWorkerDatabase,
  createWorkerEnvironment,
  createWorkerExecutionContext,
} from "../support/worker-route"

describe("Settings Worker contract", () => {
  it("returns a not-found error for a missing session", async () => {
    const database = createAuthenticatedWorkerDatabase({
      handler: (sql) =>
        sql === "SELECT user_id FROM sessions WHERE id = ?1"
          ? { rows: [] }
          : undefined,
    })
    const response = await app.fetch(
      await buildAuthenticatedWorkerRequest(
        "/api/settings/security/sessions/missing-session",
        { method: "DELETE" }
      ),
      createWorkerEnvironment({ database, environment: "development" }),
      createWorkerExecutionContext()
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      _tag: "NotFoundError",
      message: "Session not found",
    })
  })
})
