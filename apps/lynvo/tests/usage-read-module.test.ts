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
  it("recognizes the canonical Direct Media Plugin identity", async () => {
    const usageRead = createUsageReadModule({
      readLynvo: async () => ({
        metrics: [
          {
            id: "direct-media-daily",
            label: "Direct Media extractions",
            used: 2,
            limit: 30,
            unit: "extractions",
            period: "daily",
            resetsAt: "2030-02-02T00:00:00.000Z",
            pluginId: "direct-media",
          },
        ],
      }),
      readCustom: async () => [],
    })

    await expect(
      usageRead.read({
        lynvoPlugins: [
          {
            ...lynvoPlugins[0],
            id: "direct-media",
            name: "Direct Media",
          },
        ],
      })
    ).resolves.toMatchObject({
      lynvo: {
        entries: [
          {
            name: "Direct Media",
            iconKind: "direct",
          },
        ],
      },
    })
  })

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
          plugins: [{ id: "media", name: "Media Plugin" }],
          metrics: [
            {
              id: "monthly-bytes",
              label: "Transferred bytes",
              used: 4,
              limit: 40,
              unit: "bytes",
              period: "monthly",
              resetsAt: "not-a-date",
            },
            {
              id: "daily-operations",
              label: "Operations",
              used: 2,
              limit: 20,
              unit: "operations",
              period: "daily",
              resetsAt: "2030-02-03T00:00:00.000Z",
              pluginId: "media",
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

    await expect(usageRead.read({ lynvoPlugins })).resolves.toMatchObject({
      lynvo: {
        total: { used: 20, limit: 200 },
        entries: [{ name: "Daily extraction limit", used: 3, limit: 15 }],
      },
      custom: {
        groups: [
          {
            key: "custom-1",
            serverName: "Custom One",
            remainingPercent: 90,
            resetsAt: undefined,
            entries: [
              { name: "Transferred bytes", used: 4, limit: 40 },
              { name: "Media Plugin", used: 2, limit: 20 },
            ],
          },
        ],
        failures: ["Usage for Custom Two couldn’t be loaded."],
      },
    })
  })

  it("drives each Custom Plugin Server bar by its tightest quota", async () => {
    const usageRead = createUsageReadModule({
      readLynvo: async () => ({ metrics: [] }),
      readCustom: async () => [
        {
          pluginServerId: "first10",
          name: "First10 Plugin Server",
          metrics: [
            {
              id: "proxy-credits",
              label: "Monthly proxy credits",
              used: 90,
              limit: 100,
              unit: "credits",
              period: "monthly",
              resetsAt: "2030-03-01T00:00:00.000Z",
            },
            {
              id: "first10-direct-extractions",
              label: "Monthly direct extractions",
              used: 50,
              limit: 500,
              unit: "extractions",
              period: "monthly",
              resetsAt: "2030-03-01T00:00:00.000Z",
            },
            {
              id: "plugin-server-operations",
              label: "Daily requests",
              used: 12,
              limit: 100,
              unit: "operations",
              period: "daily",
              resetsAt: "2030-02-03T00:00:00.000Z",
            },
          ],
        },
      ],
    })

    await expect(usageRead.read({ lynvoPlugins: [] })).resolves.toMatchObject({
      custom: {
        groups: [
          {
            serverName: "First10 Plugin Server",
            remainingPercent: 10,
            resetsAt: "2030-03-01T00:00:00.000Z",
            entries: [
              { name: "Monthly proxy credits", used: 90, limit: 100 },
              {
                name: "Monthly direct extractions",
                used: 50,
                limit: 500,
              },
              { name: "Daily requests", used: 12, limit: 100 },
            ],
          },
        ],
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

    await expect(usageRead.read({ lynvoPlugins: [] })).resolves.toMatchObject({
      lynvo: { entries: [] },
      custom: {
        groups: [],
        failures: [
          "Custom Plugin Server usage couldn’t be loaded. Check the connection, then reload Settings.",
        ],
      },
    })
  })
})
