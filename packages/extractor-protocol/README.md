# @lynvo/extractor-protocol

Shared protocol package for Lynvo-compatible external extractor workers.

It provides:

- protocol schemas and TypeScript interfaces
- `createExtractorRuntime` for Worker route behavior
- URL matcher helpers
- Lynvo source metadata helpers
- protocol error/request builders
- contract validation helpers for external extractor tests
- mandatory finite usage schemas and authenticated runtime handling

External extractor workers in this workspace can import this local package instead of copying Lynvo schemas. It is private and does not require npm publishing.

Useful test helpers:

- `validateExtractorManifestContract(value)`
- `validateExtractSuccessContract(value)`
- `validateUsageContract(value)`
