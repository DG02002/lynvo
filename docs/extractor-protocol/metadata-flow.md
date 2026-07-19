# How Lynvo Consumes External Extractor Metadata

Lynvo treats every external extractor as a worker that publishes metadata through
the protocol. Lynvo does not need source-specific code for Resolver Beta,
File Source Delta, or any other plugin.

```mermaid
flowchart LR
  A["External worker /manifest"] --> B["Lynvo validates protocol schema"]
  B --> C["Lynvo stores worker manifest"]
  C --> D["Settings page renders worker + source plugins"]
  C --> E["Save flow matches URL to worker/source"]
  E --> F["External worker /extract"]
  F --> G["Lynvo merges extraction metadata"]
  G --> H["Saved link displays source identity"]
```

## Manifest Metadata

The manifest is Lynvo's durable source of extractor identity.

Lynvo reads:

- worker `extractorId`, `displayName`, and `iconUrl`
- source/plugin `id`, `displayName`, `iconUrl`, `status`, `version`
- source/plugin `hosts` and `matchers`

This powers:

- the external extractor settings table
- source-aware URL preview
- saved-link source labels and icons

## Extraction Metadata

`POST /extract` may return source metadata too, but it is enrichment data. It
should not be required to repeat everything from the manifest.

Lynvo merges metadata defensively:

- manifest metadata is kept when extraction omits a field
- extraction metadata can add page-level details like `pageTitle` or `audio`
- undefined extraction fields do not erase known manifest fields

## Boundary Rule

If a new external extractor supports a new source, Lynvo should not add a
source-specific branch for it. The extractor should publish that source under
`extensions.lynvo.sources`, and Lynvo should continue rendering the generic
metadata contract.
