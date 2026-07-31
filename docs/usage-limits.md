# Usage limits

Lynvo separates extraction capacity into two independent resources:

- Lynvo account quotas reserve per-user capacity before a Lynvo Plugin Server binding call.
- Lynvo Plugin Server capacity reserves global upstream capacity before Source
  work begins.

Lynvo Plugins use Lynvo-owned counters. Custom Plugin Servers expose and
enforce their own finite counters through the mandatory authenticated
`GET /usage` protocol endpoint.

## Current Lynvo Plugin limits

- 200 Lynvo Plugin extractions per account per UTC month, shared across all
  Lynvo Plugins and direct links.
- 15 Lynvo Plugin extractions per account per UTC day.
- 20,000 Lynvo Plugin extraction operations globally per UTC day.

The global daily ceiling intentionally reserves most of the Workers Free daily
allowance for authentication, settings, saved links, realtime connections, and
other dynamic application traffic.

The Lynvo Plugin Server enforces its own finite global service capacity before upstream work and reports that service-credential usage through the Plugin Server Protocol. Lynvo separately keeps the per-account quotas above because the binding credential identifies Lynvo as a service, not an individual account.

## Local development

Start local development with account usage limits disabled:

```bash
pnpm dev:local --host --no-usage
```

Omit `--no-usage` to test the normal daily and monthly account quotas. The
startup command updates only the configured development deployment. The global
daily extraction safety limit always remains enabled.

## Reset every Lynvo account

Run this from the repository root against the configured Convex deployment:

```bash
pnpm --filter @lynvo/app usage:reset
```

The reset advances a global usage epoch. Existing counter rows remain available
for later cleanup but stop affecting every account immediately.
