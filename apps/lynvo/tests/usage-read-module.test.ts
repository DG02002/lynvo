import { describe, expect, it } from "vitest"
import { createUsageReadModule } from "~/lib/usage/usage-read"

const lynvoPlugins = [
  {
    id: "drive",
    name: "Drive",
    sourceUrl: "https://drive.example",
    icon: { url: "https://drive.example/icon.png" },
    description: "Drive plugin",
    supportsDomains: false,
    domainRequired: "",
  },
]

describe("Usage Read module", () => {
  it("returns one normalized snapshot from Lynvo and Custom adapters", async () => {
    const usageRead = createUsageReadModule({
      readLynvo: async () => ({
        metrics: [
          {
            id: "lynvo-plugin-server-operations",
            label: "Daily Lynvo Plugin extractions",
            used: 3,
            limit: 15,
            unit: "extractions",
            period: "daily",
            resetsAt: "2030-02-02T00:00:00.000Z",
          },
          {
            id: "drive-monthly",
            label: "Drive extractions",
            used: 20,
            limit: 200,
            unit: "extractions",
            period: "monthly",
            resetsAt: "2030-03-01T00:00:00.000Z",
            pluginId: "drive",
          },
        ],
      }),
      readCustom: async () => [
        {
          pluginServerId: "custom-1",
          name: "Custom One",
          metrics: [
            {
              id: "monthly",
              label: "Requests",
              used: 4,
              limit: 40,
              unit: "extractions",
              period: "monthly",
              resetsAt: "not-a-date",
            },
          ],
        },
        {
          pluginServerId: "custom-2",
          name: "Custom Two",
          metrics: [],
          error: "unavailable",
        },
      ],
    })

    await expect(
      usageRead.read({ lynvoPlugins, timeBucket: 1_700_000_000_000 })
    ).resolves.toMatchObject({
      lynvo: {
        total: { used: 20, limit: 200 },
        entries: [{ name: "Daily extraction limit", used: 3, limit: 15 }],
      },
      custom: {
        total: { used: 4, limit: 40 },
        resetsAt: undefined,
        entries: [{ name: "Custom One", used: 4, limit: 40 }],
        failures: ["Usage for Custom Two couldn’t be loaded."],
      },
    })
  })

  it("keeps Lynvo usage available when the Custom adapter fails", async () => {
    const usageRead = createUsageReadModule({
      readLynvo: async () => ({ metrics: [] }),
      readCustom: async () => {
        throw new Error("offline")
      },
    })

    await expect(
      usageRead.read({ lynvoPlugins: [], timeBucket: 1 })
    ).resolves.toMatchObject({
      lynvo: { entries: [] },
      custom: {
        entries: [],
        failures: [
          "Custom Plugin Server usage couldn’t be loaded. Check the connection, then reload Settings.",
        ],
      },
    })
  })
})
