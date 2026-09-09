# Extraction failure runbook

Use this runbook when a user reports that Extraction failed after the browser
was idle, or when the Lynvo client shows a transient, rate-limit, session, or
Plugin Server error.

## Capture the request

Record the failed action, the HTTP status, and the `x-request-id` response
header. The browser retries network failures, 503 responses, and short 429
hints up to two times. It adds bounded exponential backoff with jitter, and
does not keep the extracting state open for a long `Retry-After` value. One
logical extraction reuses the same request ID for every attempt, so capture
that ID and the timestamps for all attempts if they are available.

Do not copy URLs, credentials, cookies, or response bodies into an issue. The
Worker log redacts URL-shaped values and sensitive fields, but the request ID
is safe to use for correlation.

## Trace the application Worker

In Cloudflare Workers Logs for the `lynvo` Worker, filter on the captured
`request_id`. Inspect the event fields:

- `operation: "link_extract"`
- `error_code` and HTTP `status`
- `duration_ms`
- `extraction.input_kind` and `extraction.target_host`
- `extraction.plugin_server_id` and `extraction.source_id`, when routing got
  that far

The application Worker creates or accepts the request ID and echoes it in
`x-request-id`. A 429 or 503 without a corresponding Plugin Server event
usually points to the application rate limiter or another application-side
dependency.

## Trace the Plugin Server

The application forwards the stable logical request ID as `x-request-id` when
it calls the managed or Custom Plugin Server. Filter the corresponding Plugin
Server logs on the same `request_id` and compare:

- `error_code`
- HTTP `status`
- `duration_ms`
- the Plugin Server operation and selected Plugin, if present

For managed Extraction, the application also derives an `x-operation-id` from
the request ID and input kind. Use it when the Plugin Server log exposes the
operation ID. Do not use an API key or a credential as a correlation value.

## Interpret the result

| Evidence                                         | Likely cause                                                | Next check                                                                                               |
| ------------------------------------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| No application event for the captured request ID | Browser/network failure before the Worker                   | Check connectivity, service-worker/browser extensions, and whether the retry attempts reached the origin |
| Application 429                                  | Lynvo extraction rate limit or usage limit                  | Check `Retry-After`, the account/IP limit, and the usage event                                           |
| Application 503 with no Plugin Server event      | Auth-rate limiter, binding, or other application dependency | Check the application Worker dependency and Durable Object logs                                          |
| Plugin Server 5xx or `TEMPORARY_FAILURE`         | Plugin Server or upstream Source is unavailable             | Check the Plugin Server error and upstream duration                                                      |
| `UnauthorizedError` or session mismatch          | The browser resumed with stale session identity             | Check the session status request and sign-in state                                                       |
| Application success but client decode failure    | Response contract or client compatibility issue             | Compare the response content type and body shape with the extraction API contract                        |

The retry policy is deliberately bounded. If all attempts fail, reproduce with
the same Source URL only after removing credentials from the diagnostic
request, and attach the request IDs rather than raw request data.
