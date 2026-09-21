# Lynvo vocabulary

Use these terms in code, UI copy, tests, issues, and documentation. This file
defines Lynvo's product language; it is not an architecture document or a place
for implementation plans.

## Links and playback

### Saved link

A saved source URL with its extracted Media Nodes, metadata, and opened
markers.

Saved links sync across signed-in sessions for one account without a manual
refresh.

Avoid: card, history item, saved card, recent link.

### Library

The signed-in user's full set of Saved links.

Avoid: your list, Save page, media library.

### List view

A Library presentation that shows each Saved link in a row.

### Gallery view

A Library presentation that groups related Saved links with Artwork. It is a
presentation choice, not a catalogue of media supplied by Lynvo.

Avoid: Hybrid view, artwork view.

### Artwork

Posters, season artwork, and episode stills shown for Saved links. Use "Change
artwork" for the action that lets a user choose Artwork.

### Season / Episode

Season and Episode describe TV groupings. A Season contains Episodes.

### TMDB

The third-party source Lynvo uses for title metadata and Artwork.

### Device picker

The Remote Play control for choosing a connected device.

### Save intent

The request to add a Source as a Saved link before Lynvo knows whether
Extraction can finish immediately or needs link selection.

Avoid: save request, background task.

### Selected links

Links chosen in the link-selection dialog and saved as part of a Saved link.

### Opened marker

A boolean marker set when an item is opened. It is not a playback position or
resume state.

Avoid: resume state, playback position.

### Playable link

The final URL Lynvo sends to an Android player.

### Resolvable link

A link that must be resolved before Lynvo can send a final URL to an Android
player.

Avoid: mirror.

Existing compatibility identifiers such as `resolvedMirrors` and `lazyItemUrl`
keep their internal names. Do not expose those names in product copy.

### HTTP byte-range support

Support for a partial request such as `Range: bytes=0-1` that returns a
partial-content response. Lynvo checks the response to a byte-range request;
it does not rely on the `Accept-Ranges` header alone.

### Remote Play

The current browser session sends a Playable link to another connected Lynvo
browser session. The connected session opens the URL in its external Android
player. Lynvo does not stream or play the media.

## Plugins and extraction

### Source

A website, service, or URL pattern supported by a Plugin.

Avoid: provider, Plugin Server.

### Plugin

A Source-specific implementation hosted by a Plugin Server.

### Extraction

The process of converting a Source URL or unresolved item into
normalized Media Nodes.

Avoid: scraping when referring to the complete Lynvo operation.

### Extraction queue

The account-visible lifecycle of a Saved link whose Extraction is waiting,
running, or failed and needs attention. It is part of the Saved link, not a
separate user-facing item.

Avoid: background task, extraction job.

### Media Node

A normalized playable item, folder, group, or unresolved item returned by a
Plugin Server.

Avoid: extracted link when referring to the protocol value.

### Playable item

A Media Node with a final media URL that Lynvo can send to an Android player.

### Folder

A Media Node that contains child Media Nodes for browsing. A Folder may need
another Extraction before its children are available.

### Group

A display-only Media Node that groups child Media Nodes without supplying a
catalogue entry of its own.

### Unresolved item

A Media Node that carries a Node identity and needs another Extraction before
Lynvo can show its next result.

### Node identity

The `nodeUrl` and/or opaque `resourceId` a Plugin Server uses to resolve a
Resolvable link on a later Extraction request.

Avoid: target URL when the value may be a `resourceId`.

### Direct Media link

A URL that already points to media and is validated by the Direct Media Plugin
hosted on the Lynvo Plugin Server.

Avoid: Core Direct Media flow, direct-link.

### Plugin Server

A deployed service that runs one or more Plugins and follows the Plugin Server
Protocol.

### Custom Plugin Server

A Plugin Server connected and managed by a Lynvo user.

### Lynvo Plugin Server

The Plugin Server managed by Lynvo for Lynvo Plugins.

### Lynvo Plugin Server binding

The private connection Lynvo uses to call the Lynvo Plugin Server. Its
implementation is `ServiceBindingPluginServerTransport`.

### Plugin Domain

A normalized hostname assigned by a user to a Lynvo Plugin.

Avoid: source domain, scraper domain.

### Plugin Credential

An encrypted, user-owned secret attached to one Plugin Domain and used only by
the server during Extraction.

Avoid: saved password, link password.

### Proxy key

A user-supplied proxy provider token attached to a Custom Plugin Server. Its
extractions use the user's proxy account instead of the server's shared proxy
credits.

Avoid: proxy API key, proxy token. Those names can be confused with a Plugin
Server's own API key.

### Managed extraction operation

An idempotent, leased allowance reservation for one Lynvo Plugin Extraction.
A retry with the same operation ID does not consume the allowance twice. An
abandoned reservation is released after its lease expires.

### Plugin Server Protocol

The versioned contract every Plugin Server follows when identifying Plugins,
reporting usage, and returning Media Nodes.

Lynvo maps known protocol errors to Lynvo copy at the application seam. Errors
without Lynvo-specific copy get generic Lynvo copy, and raw Plugin Server text
appears only as secondary debug detail.

## Casing

Use sentence case for all UI element types. Capitalize product terms when they
are named concepts, headings, labels, or definitions. Use lowercase in running
prose when the term is descriptive rather than a named concept. Use technical
proper nouns in their standard forms, such as "QR code", not "QR Code".
