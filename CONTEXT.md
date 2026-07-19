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
