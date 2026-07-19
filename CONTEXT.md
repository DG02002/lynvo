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

**Official Extractor**:
The server-owned, out-of-process Worker that implements Lynvo's supported
OneDrive and Bhadoo sources.

**Official Extractor Binding**:
The private Cloudflare Service Binding from Lynvo to the Official Extractor.
It is not a public endpoint and its bearer secret never reaches the browser.

**Extractor Source**:
A source implementation declared by a validated extractor manifest. Source ids
remain stable across deployments and own operational metadata such as status,
version, matchers, and credential requirements.
