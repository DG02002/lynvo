# Lynvo

Lynvo saves playable links, extracted source metadata, and playback state for a signed-in user or local browser session.

## Language

**Recent Link**:
A saved source URL with its extracted playable links, metadata, and playback state.
_Avoid_: card, history item, saved card

**Recent Links**:
The ordered collection of Recent Links shown on the Save page.
_Avoid_: recents, history

**Plugin Domain**:
A normalized hostname that a user has assigned to an official extraction plugin.
_Avoid_: source domain, scraper domain

**Plugin Credential**:
An encrypted, user-owned secret attached to one Plugin Domain and used only by the server during extraction.
_Avoid_: saved password, link password

**Plugin Server**:
A deployed service that runs one or more Plugins and follows the Plugin Server Protocol.

**Custom Plugin Server**:
A Plugin Server connected and managed by a Lynvo user.

**Lynvo Plugin Server**:
The Plugin Server managed by Lynvo for its official Plugins.

**Lynvo Plugin Server Binding**:
The private connection from Lynvo to the Lynvo Plugin Server.

**Plugin Server Protocol**:
The versioned contract every Plugin Server follows when identifying Plugins, reporting usage, and returning Media Nodes.

**Plugin**:
A source-specific implementation hosted by a Plugin Server.

**Source**:
A website, service, or URL pattern supported by a Plugin.
_Avoid_: provider, plugin server

**Extraction**:
The process of converting a Source URL or unresolved Media Node into normalized Media Nodes.
_Avoid_: scraping when referring to the complete Lynvo operation

**Media Node**:
A normalized playable item, folder, group, or unresolved item returned by a Plugin Server.
_Avoid_: extracted link when referring to the protocol value
