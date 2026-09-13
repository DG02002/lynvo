import { Schema } from "effect"

export const UsageMetricSchema = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  used: Schema.Number,
  limit: Schema.Number,
  unit: Schema.String,
  period: Schema.Literals(["daily", "monthly"]),
  resetsAt: Schema.String,
  pluginId: Schema.optional(Schema.String),
})

export const PluginServerUsageSchema = Schema.Struct({
  pluginServerId: Schema.String,
  name: Schema.String,
  iconUrl: Schema.optional(Schema.String),
  plugins: Schema.optional(
    Schema.Array(
      Schema.Struct({
        id: Schema.String,
        name: Schema.String,
        iconUrl: Schema.optional(Schema.String),
      })
    )
  ),
  metrics: Schema.Array(UsageMetricSchema),
  error: Schema.optional(Schema.String),
})

export const LynvoUsageSnapshotSchema = Schema.Struct({
  metrics: Schema.Array(UsageMetricSchema),
})

export type UsageMetric = typeof UsageMetricSchema.Type
export type PluginServerUsage = typeof PluginServerUsageSchema.Type
export type LynvoUsageSnapshot = typeof LynvoUsageSnapshotSchema.Type
