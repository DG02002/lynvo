export interface StructuredLogEvent extends Record<string, unknown> {
  event: string
  service: string
  environment: string
  timestamp: string
}

export interface StructuredLogger {
  info: (event: StructuredLogEvent) => void
  error: (event: StructuredLogEvent) => void
}

const isPrettyEnvironment = (environment: string): boolean =>
  environment === "development" ||
  environment === "local" ||
  environment === "test"

const formatPrettyEvent = (
  event: StructuredLogEvent
): Record<string, unknown> => ({
  request: `${String(event.method)} ${String(event.path)}`,
  result: `${String(event.status_code)} ${String(event.outcome)} in ${String(event.duration_ms)}ms`,
  request_id: event.request_id,
  context: event,
})

const write = (level: "info" | "error", event: StructuredLogEvent): void => {
  console[level](
    isPrettyEnvironment(event.environment)
      ? formatPrettyEvent(event)
      : JSON.stringify(event)
  )
}

export const logger: StructuredLogger = {
  info: (event) => write("info", event),
  error: (event) => write("error", event),
}
