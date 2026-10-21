import { env } from "cloudflare:workers"
import { afterEach, describe, expect, it, vi } from "vitest"

import { scheduled } from "../../workers/app"
import {
  CRON_SCHEDULE_DAILY_RETENTION,
  CRON_SCHEDULE_HOURLY_MAINTENANCE,
} from "../../workers/constants"

const runScheduled = async (cron: string, environment: Env): Promise<void> =>
  scheduled(
    { cron, scheduledTime: Date.now(), noRetry: () => undefined },
    environment
  )

const environmentWithoutDatabase = new Proxy(env, {
  get(_target, property) {
    if (property === "DB") {
      return undefined
    }
    throw new Error(`Unexpected environment read: ${String(property)}`)
  },
})

describe("scheduled Worker dispatch", () => {
  afterEach(() => vi.restoreAllMocks())

  it("runs manifest refresh and hourly D1 maintenance", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)

    await runScheduled(CRON_SCHEDULE_HOURLY_MAINTENANCE, env)

    expect(info).toHaveBeenCalledWith(
      "plugin_server_manifest_refresh",
      expect.any(Object)
    )
    expect(info).toHaveBeenCalledWith(
      "d1_maintenance",
      expect.objectContaining({
        operation: "plugin_server_registration_expiry",
      })
    )
    expect(info).toHaveBeenCalledWith(
      "account_erasure_drain",
      expect.any(Object)
    )
    expect(info).toHaveBeenCalledWith(
      "scheduled_hourly_maintenance",
      expect.objectContaining({ outcome: "success" })
    )
  })

  it("runs daily retention", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)

    await runScheduled(CRON_SCHEDULE_DAILY_RETENTION, env)

    expect(info).toHaveBeenCalledWith(
      "d1_maintenance",
      expect.objectContaining({ operation: "links_retention" })
    )
    expect(info).toHaveBeenCalledWith(
      "scheduled_daily_retention",
      expect.objectContaining({ outcome: "success" })
    )
  })

  it("runs high-frequency drains and sweeps for the other cron branch", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)

    await runScheduled("* * * * *", env)

    expect(info).toHaveBeenCalledWith("d1_auth_sweep", expect.any(Object))
    expect(info).toHaveBeenCalledWith(
      "d1_maintenance",
      expect.objectContaining({ operation: "managed_extraction_lease_expiry" })
    )
    expect(info).toHaveBeenCalledWith(
      "d1_maintenance",
      expect.objectContaining({ operation: "remote_commands_ttl" })
    )
    expect(info).toHaveBeenCalledWith(
      "d1_maintenance",
      expect.objectContaining({ operation: "link_command_operations_ttl" })
    )
    expect(info).toHaveBeenCalledWith(
      "scheduled_delivery_drain",
      expect.objectContaining({ outcome: "success", d1_sweep: "swept" })
    )
  })

  it("skips hourly D1 work when the binding is unavailable", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)

    await runScheduled(
      CRON_SCHEDULE_HOURLY_MAINTENANCE,
      environmentWithoutDatabase
    )

    expect(info).toHaveBeenCalledWith(
      "scheduled_hourly_maintenance",
      expect.objectContaining({ outcome: "success" })
    )
    expect(info).not.toHaveBeenCalledWith("d1_maintenance", expect.anything())
  })

  it("skips daily retention when the binding is unavailable", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)

    await runScheduled(
      CRON_SCHEDULE_DAILY_RETENTION,
      environmentWithoutDatabase
    )

    expect(info).toHaveBeenCalledWith(
      "scheduled_daily_retention",
      expect.objectContaining({ outcome: "success" })
    )
    expect(info).not.toHaveBeenCalledWith("d1_maintenance", expect.anything())
  })

  it("skips high-frequency D1 work when the binding is unavailable", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)

    await runScheduled("* * * * *", environmentWithoutDatabase)

    expect(info).toHaveBeenCalledWith(
      "scheduled_delivery_drain",
      expect.objectContaining({ outcome: "success", d1_sweep: "skipped" })
    )
    expect(info).not.toHaveBeenCalledWith("d1_auth_sweep", expect.anything())
    expect(info).not.toHaveBeenCalledWith("d1_maintenance", expect.anything())
  })
})
