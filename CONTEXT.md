# Lynvo

The Lynvo website can be opened in any browser for sign-in and link
management. Link handoff is designed for Android phones, Android tablets, and
Android TV. Lynvo opens links in four Android players: Just (Video) Player, VLC
for Android, MPV, and MX Player.

Lynvo marks an item opened the first time you open it, but it does not store a
playback position or resume state. Lynvo does not play video; it opens a URL in
an external Android player. When you open the same link again, Lynvo sends the
same URL to the selected player. Just (Video) Player is recommended for links
whose servers support HTTP byte-range requests, which can enable seeking. It
can open other links too, but it cannot seek when the server does not support
HTTP byte-range requests. VLC for Android is recommended for those links; VLC
may still allow seeking in some cases. The selected player may remember its
own playback position. MPV and MX Player are also available choices.

Lynvo stores saved links, extracted source metadata, and opened markers for a
signed-in account. Drafts are separate browser-local snapshots and expire
after 7 days.

## Language

**Saved link**:
A saved source URL with its extracted playable links, metadata, and opened
markers.
_Avoid_: card, history item, saved card, recent link

**Selected links**:
Links the user chooses in the link-selection dialog and saves as part of a
saved link. This is separate from a draft.

**Draft**:
A browser-local snapshot of the current extraction tree. **Save draft** stores
the tree without selection state and keeps it for 7 days.

**Opened item**:
A boolean marker Lynvo sets when you open an item. It is not a playback
position or resume state.
_Avoid_: resume state, playback position

**Playable link**:
The final URL Lynvo sends to an Android player.

**Resolvable link**:
A link that must be resolved before Lynvo can send a final URL to an Android
player.

**HTTP byte-range support**:
A link server supports HTTP byte-range requests when it can answer a request
such as `Range: bytes=0-1` with a partial-content response. The server may not
send an `Accept-Ranges` header; Lynvo checks the response to a byte-range
request instead of relying on that header alone.

**Remote Play**:
The current browser session sends a playable URL to another connected Lynvo
browser session. The connected session opens that URL in its external Android
player. Lynvo does not stream or play the media.

**Direct Media link**:
A URL that already points to media and does not need Plugin Server extraction.

**Plugin Domain**:
A normalized hostname that a user has assigned to a Lynvo Plugin.
_Avoid_: source domain, scraper domain

**Plugin Credential**:
An encrypted, user-owned secret attached to one Plugin Domain and used only by the server during extraction.
_Avoid_: saved password, link password

**Plugin Server**:
A deployed service that runs one or more Plugins and follows the Plugin Server Protocol.

**Custom Plugin Server**:
A Plugin Server connected and managed by a Lynvo user.

**Lynvo Plugin Server**:
The Plugin Server managed by Lynvo for Lynvo Plugins.

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
