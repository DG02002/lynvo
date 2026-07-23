export {}

declare global {
  const __BUILD_TIME__: string

  interface UsageMetric {
    id: string
    label: string
    used: number
    limit: number
    unit: string
    period: "daily" | "monthly"
    resetsAt: string
    sourceId?: string
  }

  interface ExternalWorkerUsage {
    workerId: string
    name: string
    iconUrl?: string
    sources?: readonly {
      id: string
      name: string
      iconUrl?: string
    }[]
    metrics: readonly UsageMetric[]
    error?: string
  }

  interface CookiePreferences {
    analytics: boolean
    marketingMeasurement: boolean
    personalizedMarketing: boolean
    version: number
  }
}
