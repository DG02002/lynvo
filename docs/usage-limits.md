# Usage limits

Lynvo separates extraction capacity into two independent resources:

- Worker operations count network extraction work against the hosting platform.
- Provider credits count calls to a paid or shared upstream proxy.

Official plugins use Lynvo-owned counters. External extractors expose and
enforce their own finite counters through the mandatory authenticated
`GET /usage` protocol endpoint.

## Current official limits

- 100 official extraction operations per account per UTC day.
- 20,000 official extraction operations globally per UTC day.
- 50 Bhadoo Google Drive Index extractions per account per month.
- 50 OneDrive Index extractions per account per month.
- 200 direct-link extractions per account per month.

The global daily ceiling intentionally reserves most of the Workers Free daily
allowance for authentication, settings, saved links, realtime connections, and
other dynamic application traffic.

The official extractor enforces its own finite global service capacity before upstream work and reports that service-credential usage through the extractor protocol. Lynvo separately keeps the per-account quotas above because the binding credential identifies Lynvo as a service, not an individual account.

## Reset every Lynvo account

Run this from the repository root against the configured Convex deployment:

```bash
pnpm --filter @lynvo/app usage:reset
```

The reset advances a global usage epoch. Existing counter rows remain available
for later cleanup but stop affecting every account immediately.
