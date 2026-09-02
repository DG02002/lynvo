# Lynvo vocabulary

Use these terms in code, UI copy, tests, issues, and documentation. This file
defines Lynvo's product language; it is not an architecture document or a place
for implementation plans.

## Links and playback

### Saved link

A saved source URL with its extracted Media Nodes, metadata, and opened
markers.

Avoid: card, history item, saved card, recent link.

### Save intent

The request to add a Source as a Saved link before Lynvo knows whether
Extraction can finish immediately or needs link selection.

Avoid: save request, background task.

### Selected links

Links chosen in the link-selection dialog and saved as part of a Saved link.

### Account-synchronized Saved links

Saved links that sync across active sessions for one signed-in account without
a manual refresh.

### Draft

A browser-local snapshot of unfinished save input. Drafts are separate from
account-synchronized Saved links and expire after 7 days.

### Opened item

A boolean marker set when an item is opened. It is not a playback position or
resume state.

Avoid: resume state, playback position.

### Playable link

The final URL Lynvo sends to an Android player.

### Resolvable link

A link that must be resolved before Lynvo can send a final URL to an Android
player.

### Media container

A Resolvable link representing one media item that resolves into one or more
Playable links, such as 1080p and 2160p variants. A Media container is not a
Folder.

Avoid: folder, lazy folder, mirror.

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

The process of converting a Source URL or unresolved Media Node into
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

The private connection Lynvo uses to call the Lynvo Plugin Server.

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
