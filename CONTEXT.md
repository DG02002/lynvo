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

**Save intent**:
The user’s request to add a Source as a Saved link before Lynvo knows whether
Extraction can finish immediately or needs link selection.
_Avoid_: save request, background task

**Selected links**:
Links the user chooses in the link-selection dialog and saves as part of a
saved link.

**Account-synchronized Saved links**:
Saved links belonging to a signed-in account that converge across active
sessions without manual refresh.

**Opened item**:
A boolean marker Lynvo sets when you open an item. It is not a playback
position or resume state.
_Avoid_: resume state, playback position

**Playable link**:
The final URL Lynvo sends to an Android player.

**Resolvable link**:
A link that must be resolved before Lynvo can send a final URL to an Android
player.

**Media container**:
A Resolvable link that represents one media item and resolves into one or more
Playable links, such as 1080p and 2160p variants. It is not a Folder.
_Avoid_: folder, lazy folder, mirror

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
A URL that already points to media and is validated by the Direct Media Plugin
hosted on the Lynvo Plugin Server.
_Avoid_: Core Direct Media flow, direct-link

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

**Proxy key**:
A user-supplied proxy provider token attached to a Custom Plugin Server, so its extractions bill the user's own proxy account instead of the server's shared proxy credits.
_Avoid_: proxy API key, proxy token (confusable with the Plugin Server's own API key)

**Lynvo Plugin Server**:
The Plugin Server managed by Lynvo for Lynvo Plugins.

**Lynvo Plugin Server Binding**:
The private connection from Lynvo to the Lynvo Plugin Server.

**Managed extraction operation**:
An idempotent, leased allowance reservation for one Lynvo Plugin extraction. A
retry with the same operation ID does not consume twice; an abandoned
reservation is released after its lease expires.

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

**Extraction queue**:
The account-visible lifecycle of a Saved link whose Extraction is waiting, running, or has failed and needs attention. It is part of the Saved link, not a separate user-facing item.
_Avoid_: background task, extraction job

**Media Node**:
A normalized playable item, folder, group, or unresolved item returned by a Plugin Server.
_Avoid_: extracted link when referring to the protocol value

**Product update**:
A public change to Lynvo’s user-facing features or reliability. Improvements to saving, deleting, and synchronizing links belong here.
_Avoid_: platform update for user-facing Lynvo changes

**Plugin Server update**:
A public change to a Lynvo Plugin Server or its integration contract.
