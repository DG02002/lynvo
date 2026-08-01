# Pre-release language and domain cleanup plan

Status: complete
Date: 2026-08-01

## Objective

Bring the pre-release Lynvo application, API, backend modules, documentation,
policies, and tests into one accurate vocabulary based on the Apple HIG writing
and inclusive-writing guidance.

The cleanup should make the code describe the product that exists today:

- saved links are represented as a list of link items, not cards;
- QR login is a generic device-login flow, not a TV-only flow;
- Plugin Domains, Plugin Credentials, Plugin Servers, and Recent Links use
  their canonical product terms where those terms are useful to users;
- the core license and package-level license boundaries are visible and
  accurately described.

Because Lynvo is not public or deployed, perform the renames directly. Do not
add compatibility aliases, API migration layers, or legacy-name support unless
implementation discovers an actual local development dependency that requires
one.

## Decisions

- Use `links` and `LinkItem` for the saved-link list implementation. Do not add
  `Recent` or `Card` to feature-local API, variable, component, or test names.
- Rename feature-local `RecentLink*` view, hook, persistence, and mapper names
  to `Link*` equivalents. Keep “Recent Links” only where it is intentionally
  the user-facing product label or a deliberately documented policy term.
- Rename list operations to `clearLinks`, `linkLimitBytes`, and
  `cleanupExpiredLinks` where the surrounding module already establishes the
  saved-link context.
- Rename item-level UI concepts to `LinkItemMenu` and `LinkItemActions`.
- Name plugin-domain parsing and suggestion values as `PluginDomain*`, not
  generic source-URL candidates.
- Keep “Recent Links” available as the formal user-facing product term where it
  distinguishes the saved-link collection from other links. Use “saved links”
  in natural explanatory copy when it is clearer.
- Change the QR approval URL from `/tv?code=...` to `/device?code=...`.
- Rename the internal TV-specific authentication abstractions to generic
  device-auth names. Keep “TV” in Android TV documentation and fixtures when
  the target device is actually a TV.
- Use the existing Telegram support channel and GitHub Issues instead of
  introducing an email address. Replace vague “official contact method” text
  with explicit links to those channels.
- Add a visible open-source license page and footer link. Do not weaken the
  service’s content-rights, credential, usage-limit, privacy, or abuse rules
  because the software has a proper license.

## Phase 1: Rename saved-link list terminology

Update implementation names across the app, Convex functions, API response
fields, storage settings, scheduled cleanup, and tests.

Expected renames include:

| Current name | New name |
| --- | --- |
| `clearRecentCards` | `clearLinks` |
| `recentCardLimitBytes` | `linkLimitBytes` |
| `cleanupExpiredRecentCards` | `cleanupExpiredLinks` |
| `CardDotMenu` | `LinkItemMenu` |
| `CardDotMenuProps` | `LinkItemMenuProps` |
| `LinkCardActions` | `LinkItemActions` |
| `recents` / `combinedRecents` | `links` / `combinedLinks` |
| `RECENTS_MAX_LIMIT` | `LINKS_MAX_LIMIT` |
| `RECENTS_KEY` | `LINKS_KEY` |
| `RecentLinkViewItem` | `LinkViewItem` |
| `useRecentLinks` | `useLinks` |
| `RecentLinksPersistence` | `LinksPersistence` |

Review and update at least:

- `apps/lynvo/convex/users.ts`
- `apps/lynvo/convex/links.ts`
- `apps/lynvo/convex/crons.ts`
- `apps/lynvo/app/lib/effect/api/handlers/settings-handlers.ts`
- `apps/lynvo/app/lib/effect/api/groups/settings-group.ts`
- `apps/lynvo/app/features/site/settings/storage-settings.tsx`
- `apps/lynvo/app/features/links/use-recent-links/`
- `apps/lynvo/app/components/links/CardDotMenu.tsx`
- `apps/lynvo/app/components/save-list/`
- extraction and link-action orchestration modules

Since this is pre-release, rename the local storage key literals and remove
old-key fallback logic if present. Confirm that no generated Convex file is
edited manually; regenerate generated API files after the source module names
change.

## Phase 2: Generalize QR device login

The current QR destination is generated in
`apps/lynvo/app/components/auth/TvSignInQr.tsx`, routed in `apps/lynvo/app/routes.ts`,
and backed by `/api/auth/tv/*` plus `convex/tv.ts`. Rename the complete flow.

Use this public URL:

```text
/device?code=12345678
```

Rename the main pieces:

- `_auth.tv.tsx` → `_auth.device.tsx`
- `TvAuth` → `DeviceApproval`
- `TvSignInQr` → `DeviceLoginQr`
- `TvGroup` → `DeviceAuthGroup`
- `TvHandlers` → `DeviceAuthHandlers`
- `client.tv` → `client.device`
- `convex/tv.ts` → `convex/deviceAuth.ts` (matching the repository's existing
  Convex module naming)
- `api.tv` → `api.deviceAuth` or the repository’s equivalent generated name
- `/api/auth/tv/code` and `/api/auth/tv/*` → `/api/auth/device/*`
- `tv-auth.test.tsx` → `device-auth.test.tsx`

Update the route comment from “TV Pairing” to “Device login.” Keep the
Android-TV setup guide’s TV-specific instructions, but make its underlying
login flow refer to generic device login.

Use approval language on the scanned-device page:

- “Log in this device” → “Approve login”
- “Device logged in” → “Device login approved”
- “Log in {deviceName}?” → “Approve login for {deviceName}?”
- “Logging in…” → “Approving login…”

Update the tests to assert the new route, API paths, component names, and copy.
Keep a TV fixture such as “Living room TV,” and add or retain a non-TV device
fixture to prove that the flow is genuinely generic.

## Phase 3: Correct user-facing copy

Apply the confirmed HIG fixes without rewriting copy that already meets the
guidance.

### Product terminology

- Replace “source domain,” “site,” and “login details” with Plugin Domain and
  Plugin Credential wording where the settings feature is describing those
  objects.
- Change the bare “Add” action to “Add domain.”
- Replace “history,” “watchlist,” and “saved item” with “saved links,” “Recent
  Links,” or “link” according to context.
- Replace generic or ambiguous “Copied” toasts with “Link copied.”
- Replace “Down”/`is down` with a user-facing status such as “Unavailable” or
  “Maintenance,” and replace “View upstream project” with “View project” or
  “View source project.”

### Device and platform copy

- Correct the changelog’s “desktop and TV players” claim to match the actual
  Android and Android TV support.
- Change progress copy such as “Remote: Opening player” to
  “Opening player…”.
- Add the required ellipsis to loading accessibility text such as
  “Reloading link choices…”.
- Use sentence case for “Terms of use,” “Privacy policy,” “Help center,” and
  similar labels.
- Replace “How can we help?” with a direct phrase such as “Get help with
  Lynvo.”
- Make remote-device status copy generic and sentence case.

### Documentation and protocol language

- Replace protocol “saved-item” wording with Recent Link, saved link, or Media
  Node according to the layer being documented.
- Replace “managed official manifest” with “Lynvo Plugin Server manifest.”
- Change the Plugin Server documentation navigation label from “Create a
  Worker” to “Create a Plugin Server.” Keep “Cloudflare Worker” when it refers
  specifically to the runtime platform.

## Phase 4: Update policies and license presentation

### Contact channels

Reuse the existing support URLs from the Help Center:

- Telegram: `https://t.me/lynvo_support`
- GitHub Issues: `https://github.com/DG02002/lynvo/issues`

Replace “official contact method displayed by Lynvo/Service” in the Terms,
Privacy, Cookie, and Usage policies with explicit links. Describe Telegram as
the private contact channel and GitHub Issues as the public support/bug channel
where appropriate.

### License page

Add a `/policies/licenses` route and link it from the footer. The page should:

- identify the Lynvo core project as AGPL-3.0 licensed;
- link to the repository’s full `LICENSE` file and source repository;
- include the project copyright notice, no-warranty notice, and instructions
  for viewing the license;
- identify the independently MIT-licensed protocol and creator packages;
- explain that the software license is separate from hosted-service terms,
  third-party content rights, source-site terms, trademarks, and availability;
- identify whether the deployed source corresponds to the published source, if
  and when a deployment exists.

Have the final legal wording reviewed before publishing. Do not state that the
public repository is the corresponding source for a deployment unless it is
actually equivalent to that deployment.

### Policy consistency

Retain and verify the existing rules for:

- content rights and source-site terms;
- Plugin Credential handling;
- account deletion and retention;
- usage limits and storage limits;
- Custom Plugin Server responsibilities;
- privacy and children’s data;
- suspension, warranty, and liability terms.

Update policy copy to use the canonical saved-link terminology and keep the
documented quantities synchronized with the application.

## Phase 5: Update tests and verification

Update test filenames, descriptions, fixtures, and assertions together with
the implementation renames. Review at least:

- `tests/tv-auth.test.tsx`
- `tests/convex-device-auth.test.ts`
- `tests/components/add-source-domain-alert-dialog.test.tsx`
- `tests/components/custom-plugin-server-table.test.tsx`
- `tests/components/card-dot-menu.test.tsx`
- `tests/use-recent-links.test.tsx`
- save-list and extraction/orchestration tests
- storage and cleanup lifecycle tests
- worker-auth and credential-vault tests
- `tests/policy-copy.test.tsx`
- `tests/marketing-copy.test.tsx`
- `tests/help-center-copy.test.tsx`

Add assertions for:

- the generic `/device?code=` QR destination;
- “Approve login” wording;
- no stale `Card`, `RecentCard`, or feature-local `recents` names;
- no user-facing “history,” “watchlist,” “saved item,” “source domain,” or
  “upstream project” wording where the canonical term applies;
- explicit Telegram and GitHub support links in policy pages;
- the visible license page/footer link;
- synchronized limits, retention periods, cookie labels, and platform claims.

Run:

```sh
pnpm run check:copy
pnpm run check:terminology
pnpm run typecheck
pnpm test
```

Also run a repository-wide search for the old identifiers after the rename,
excluding generated files only when the generated files are regenerated as
part of the verification step.

## Acceptance criteria

- No application, Convex, API, component, or test identifier describes saved
  links as cards or recent cards.
- The saved-link list uses `links`, `clearLinks`, and `LinkItem*` terminology.
- QR login works through `/device?code=...` for TV, phone, tablet, and other
  device names without TV-specific implementation names.
- Android TV documentation remains accurate and still uses TV-specific wording
  where appropriate.
- User-facing copy passes the existing copy and terminology checks.
- Policies link to Telegram, GitHub Issues, and the license page explicitly.
- The license page accurately separates AGPL core licensing, MIT package
  licensing, and hosted-service rules.
- All code and test suites pass, and no files under generated UI primitives are
  modified.

## Out of scope

- No production data migration or backward-compatibility layer.
- No email support channel.

## Implementation notes

- Saved-link APIs, persistence, storage-ledger fields, cleanup jobs, menus, and
  tests now use `links`, `LinkItem*`, `clearLinks`, and `linkBytes` terminology.
- QR login now uses `/device?code=...`, generic device-auth modules, and tests
  covering both TV and non-TV device names.
- The `/policies/licenses` page links the AGPL-3.0 core license, both MIT
  package licenses, the source repository, Telegram, and GitHub Issues.
- No compatibility aliases or data migration were added because Lynvo is
  pre-release and has no deployed users.
- Verified with copy, terminology, formatting, lint, typecheck, and the full
  workspace test suite.
- No broad rewrite of copy that already follows the Apple HIG guidance.
- No change to the AGPL/MIT license choices without a separate legal or
  release decision.
- No removal of content-rights, privacy, credential, quota, or abuse policies.
