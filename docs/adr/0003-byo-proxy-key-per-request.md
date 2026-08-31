# Bring-your-own proxy keys are forwarded per extraction, not stored by the Plugin Server

Scrape.do credits limit proxy-backed extractions. The shared pool is the
operator's free-plan budget, so it limits how much any one user can extract. A
user can attach a Proxy key, their own Scrape.do token, to a Custom Plugin
Server. Lynvo sends the token in each `/extract` request instead of storing it
on the Plugin Server. Lynvo keeps it encrypted in its credential vault with
the same protection as the Plugin Server API key, sends it only to servers
whose manifest declares `proxyProvider: "scrape-do"`, and the Plugin Server
uses it for that request's upstream proxy calls. Daily operation caps still
apply, but the request does not use the shared proxy quota.

Rejected alternative: letting the Plugin Server store per-user proxy keys.
That would force every Plugin Server author to build encrypted-secret storage
and would leave a user's Scrape.do token on a third-party server indefinitely.
Per-request forwarding shows the trust decision to the user, follows the
existing Plugin Credential flow, and adds one field to the extract request.
