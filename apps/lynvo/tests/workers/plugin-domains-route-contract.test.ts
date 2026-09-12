import { describe, expect, it } from "vitest"
import app from "../../workers/app"
import {
  buildAuthenticatedWorkerRequest,
  createAuthenticatedWorkerDatabase,
  createWorkerEnvironment,
  createWorkerExecutionContext,
} from "../support/worker-route"

const domainRow = {
  id: "domain-1",
  user_id: "user-1",
  plugin_server_id: "server-1",
  domain: "example.com",
  plugin_id: "plugin-1",
  credential_generation: 1,
  credential_attempt_id: "attempt-1",
  credential_finalized_attempt_id: null,
}

const readyServerRow = { credential_status: "ready" }

describe("Plugin Domains Worker error contract", () => {
  it("exposes a missing domain as a typed not-found error", async () => {
    const database = createAuthenticatedWorkerDatabase({
      handler: (sql) =>
        sql.includes("FROM user_plugin_domains WHERE id = ?1")
          ? { rows: [] }
          : undefined,
    })
    const response = await app.fetch(
      await buildAuthenticatedWorkerRequest(
        "/api/plugin-domains/missing-domain/credential",
        { method: "DELETE" }
      ),
      createWorkerEnvironment({
        database,
        environment: "development",
      }),
      createWorkerExecutionContext()
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      _tag: "PluginDomainNotFoundError",
      message: "Plugin domain not found",
    })
  })

  it("exposes a missing plugin server as a typed unavailable error", async () => {
    const database = createAuthenticatedWorkerDatabase({
      handler: (sql) =>
        sql.includes("FROM user_plugin_servers WHERE id = ?1 AND user_id = ?2")
          ? { rows: [] }
          : undefined,
    })
    const response = await app.fetch(
      await buildAuthenticatedWorkerRequest("/api/plugin-domains", {
        method: "POST",
        body: {
          domain: "https://example.com",
          pluginServerId: "missing-server",
          pluginId: "plugin-1",
        },
      }),
      createWorkerEnvironment({
        database,
        environment: "development",
      }),
      createWorkerExecutionContext()
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      _tag: "PluginServerUnavailableError",
      message: "Plugin server not found or no longer available",
    })
  })

  it("exposes a lost credential attempt as a typed conflict", async () => {
    const database = createAuthenticatedWorkerDatabase({
      handler: (sql) => {
        if (sql.includes("UPDATE users SET data_version")) {
          return { rows: [] }
        }
        if (sql.includes("FROM user_plugin_domains WHERE id = ?1")) {
          return { row: domainRow }
        }
        if (
          sql.includes(
            "FROM user_plugin_servers WHERE id = ?1 AND user_id = ?2"
          )
        ) {
          return { row: readyServerRow }
        }
        return undefined
      },
    })
    const response = await app.fetch(
      await buildAuthenticatedWorkerRequest(
        "/api/plugin-domains/domain-1/credential",
        {
          method: "PATCH",
          body: { password: "password" },
        }
      ),
      createWorkerEnvironment({
        database,
        environment: "development",
      }),
      createWorkerExecutionContext()
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      _tag: "PluginCredentialChangeSupersededError",
      message: "Plugin credential change was superseded",
    })
  })
})
