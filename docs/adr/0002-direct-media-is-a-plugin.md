# Direct Media is a Lynvo Plugin

Direct Media uses the Plugin Server Protocol and is hosted by the Lynvo Plugin
Server. Lynvo Core does not probe media URLs or maintain a second extraction
path; explicit selection, configured Plugin Domains, and static matches take
precedence before the Direct Media capability probe. This keeps routing,
allowance accounting, capacity control, errors, observability, and saved-link
affinity on one managed-extraction boundary.
