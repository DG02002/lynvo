# Usage limits

Lynvo separates extraction capacity into two independent resources:

- Lynvo account quotas reserve per-user capacity before an official binding call.
- Extractor service capacity reserves global upstream capacity inside the
  official Worker before source work begins.

Official plugins use Lynvo-owned counters. External extractors expose and
enforce their own finite counters through the mandatory authenticated
`GET /usage` protocol endpoint.

## Current official limits

- 200 official extractions per account per UTC month, shared across all
  official plugins and direct links.
- 15 official extractions per account per UTC day.
- 20,000 official extraction operations globally per UTC day.

The global daily ceiling intentionally reserves most of the Workers Free daily
allowance for authentication, settings, saved links, realtime connections, and
other dynamic application traffic.

The Lynvo Plugin Server enforces its own finite global service capacity before upstream work and reports that service-credential usage through the extractor protocol. Lynvo separately keeps the per-account quotas above because the binding credential identifies Lynvo as a service, not an individual account.

## Local development

Start local development with account usage limits disabled:

```bash
pnpm dev:local --host --no-usage
```

Omit `--no-usage` to test the normal daily and monthly account quotas. The
startup command updates only the configured development deployment. The global
daily extractor safety limit always remains enabled.

## Reset every Lynvo account

Run this from the repository root against the configured Convex deployment:

```bash
pnpm --filter @lynvo/app usage:reset
```

The reset advances a global usage epoch. Existing counter rows remain available
for later cleanup but stop affecting every account immediately.
