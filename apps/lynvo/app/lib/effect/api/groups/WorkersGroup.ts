import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { WebAuth, CsrfMiddleware } from "../Middleware"
import {
  UnauthorizedApiError,
  CsrfApiError,
  ValidationApiError,
  WorkerRegistrationApiError,
  ConvexApiError,
} from "../../errors"

const UsageMetricSchema = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  used: Schema.Number,
  limit: Schema.Number,
  unit: Schema.String,
  period: Schema.Literals(["daily", "monthly"]),
  resetsAt: Schema.String,
  sourceId: Schema.optional(Schema.String),
})

const WorkerUsageSchema = Schema.Struct({
  workerId: Schema.String,
  name: Schema.String,
  iconUrl: Schema.optional(Schema.String),
  sources: Schema.optional(
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

export class WorkersGroup extends HttpApiGroup.make("workers")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: Schema.Array(Schema.Unknown),
      error: [UnauthorizedApiError, ConvexApiError],
    }),
    HttpApiEndpoint.get("usage", "/usage", {
      success: Schema.Array(WorkerUsageSchema),
      error: [UnauthorizedApiError, ConvexApiError],
    }),
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Struct({
        baseUrl: Schema.String,
        apiKey: Schema.String,
      }),
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [
        WorkerRegistrationApiError,
        ValidationApiError,
        UnauthorizedApiError,
        ConvexApiError,
        CsrfApiError,
      ],
    }),
    HttpApiEndpoint.post("toggle", "/:workerId/toggle", {
      params: {
        workerId: Schema.String,
      },
      payload: Schema.Struct({
        enabled: Schema.Boolean,
      }),
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedApiError, CsrfApiError, ConvexApiError],
    }),
    HttpApiEndpoint.post("refresh", "/:workerId/refresh", {
      params: {
        workerId: Schema.String,
      },
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [
        WorkerRegistrationApiError,
        UnauthorizedApiError,
        ConvexApiError,
        CsrfApiError,
      ],
    }),
    HttpApiEndpoint.delete("delete", "/:workerId", {
      params: {
        workerId: Schema.String,
      },
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [UnauthorizedApiError, CsrfApiError, ConvexApiError],
    })
  )
  .middleware(WebAuth)
  .middleware(CsrfMiddleware)
  .prefix("/api/workers") {}
