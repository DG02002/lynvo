# Docs

## Overview

This folder contains project documentation for Lynvo.

## Available Guides

- [Setup](./setup.md)
  - Local Convex Auth, Turnstile, Cloudflare Workers, and deployment setup.
- [Invite Codes](./invite-codes.md)
  - Admin invite-code generation and usage flow.
- [Usage Limits](./usage-limits.md)
  - Official and external extractor accounting, limits, and operator reset.
- [Extractor Protocol](./extractor-protocol/spec.md)
  - The Lynvo-owned external extractor worker protocol v1.
- [Extractor Author Guide](./extractor-protocol/author-guide.md)
  - Recommended Hono + Cloudflare Workers implementation guidance for worker authors.
- [Legacy Plugin Mapping](./extractor-protocol/legacy-plugin-mapping.md)
  - How current in-repo extractor behavior maps to the new worker protocol.

## Extractor Docs

The external extractor design lives under [extractor-protocol](./extractor-protocol/).

Read in this order:

1. [spec.md](./extractor-protocol/spec.md)
2. [author-guide.md](./extractor-protocol/author-guide.md)
3. [legacy-plugin-mapping.md](./extractor-protocol/legacy-plugin-mapping.md)
