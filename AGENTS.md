# Lynvo

Lynvo is a link library for saving supported source URLs, extracting playable
links, and opening them in external Android players. It began with a simple
Android TV problem: move a link from a phone or browser to a TV without typing
a long URL with a remote.

Keep the product simple, predictable, and useful as it grows.

## What makes Lynvo special?

We now have 100 users. It is important to maintain the things that make Lynvo
useful as we iterate. Here is what we cannot compromise on.

Lynvo is not another Stremio-style catalogue. It starts with links people
choose and helps them get those links to the player they already use.

### 1. A link library, not a media catalogue

Lynvo does not provide a catalogue, supply media, or decide what belongs in a
user's library. People add their own supported URLs and are responsible for
having permission to access and play them.

### 2. Built around the player handoff

The core workflow is saving a link in a browser, finding it on Android TV or
another signed-in session, and opening it in Just (Video) Player, VLC for
Android, MPV, or MX Player without typing a long media URL with a TV remote.
Lynvo does not stream media or own playback position.

### 3. Source integrations without a media-player fork

Plugins resolve supported direct media links and source pages such as Bhadoo
Google Drive Index and OneDrive Index. The Plugin Server Protocol lets other
compatible Sources connect without moving Source-specific complexity into the
application core.

### 4. The user's selections stay theirs

Catalogue products organize around their own catalogue. Lynvo starts with the
link a user chooses, so the Saved link reflects that selection instead of an
add-on's catalogue.

## Priorities

Performance, stability, and reliability come first. Treat retries, reconnects,
partial streams, stale clients, and failed upstream calls as normal product
states. If a tradeoff is required, choose correctness and robustness over
short-term convenience. In the code itself, prioritize correctness and
clarity; speed and efficiency are secondary unless the task says otherwise.

Long-term maintainability is a core priority. If you add new functionality,
first check if shared logic can be extracted into a separate module. Duplicate
logic across multiple files is a code smell and should be avoided. Don't be
afraid to change existing code. Don't take shortcuts by just adding local
logic to solve a problem. Prefer implementing functionality in existing
files unless it is a new logical component, and avoid creating many small
files.

## A note from Lynvo

I like ambitious ideas, simple systems, and software that feels obvious. Do not preserve complexity just because it already exists. Do not introduce machinery because it looks architecturally impressive. Understand the real constraint, then fight for the smallest model that makes the correct behavior unsurprising.

Channel both "measure twice, cut once" and "yagni". Fight scope creep. Try to honor the dev's intent in both a minimal and realistic fashion.

The rest of this document is meant to help you navigate the codebase and make changes effectively. Think of these instructions less as "hard rules", more as "good defaults". The developer's preferences should be able to override anything here. If a rule in this file fights the task in front of you, say so loudly and get a human sign-off before breaking it.

## A small glossary

Use the product terms in `CONTEXT.md` instead of inventing synonyms.

- **you** means the agent reading this file and changing Lynvo.
- **agent** means the coding agent working in this repository.
- **we**, **us**, and **maintainers** mean the people building and maintaining
  Lynvo.
- **user** means a person using the hosted Lynvo service or a generated Plugin
  Server project.
- **environment** means a Lynvo deployment and the bindings, data, and
  services it owns.
- **Lynvo app** means the React Router application and its Cloudflare Worker.
- **managed Plugin Server** means the Worker operated by Lynvo for first-party
  Plugins.
- **Custom Plugin Server** means a server a Lynvo user connects and manages.
- **public package** means the published protocol package or standalone Plugin
  Server creator package.

## Product invariants

- D1 is the only Lynvo application database.
- Every Saved link mutation goes through the Worker API with a client-generated
  `operationId`. The server idempotency ledger handles retries.
- The server snapshot is the persisted client state for Saved links. Use
  server-assigned IDs, not URLs, as entity identity.
- Each owned-data write increments the account `data_version` in the same D1
  transaction and returns it in the response body and
  `X-Lynvo-Data-Version` header.
- WebSocket `data-changed` messages reduce latency. They never establish
  freshness by themselves. Compare versions and fetch the server snapshot.
- Browser code uses only the opaque HttpOnly `lynvo_session` cookie for
  authentication. Sign-in is Google-only.
- Plugin Server API keys stay on the server. Browser code talks to Lynvo, not
  directly to a Plugin Server.

## Hit every surface

The most common defect is a change that works on the path you tested and is
missing everywhere else. Before calling work done, walk this list and say
which entries applied. Fixing one path is not fixing the feature.

- **Entry points.** Save, settings, Plugin configuration, link selection,
  Remote Play, and in-app docs.
- **Sources.** Changes that touch link resolution need a decision per Source
  adapter, even if the decision is that it does not apply here.
- **Contracts.** Browser and Worker APIs, D1, Durable Objects, realtime
  messages, the Plugin Server Protocol, public packages, and generated
  projects.
- **Reverse states.** Retry, refresh, reconnect, reopen, remove, cancel, and
  sign out.
- **Docs.** User-visible behavior belongs in the in-app MDX. Architecture and
  maintainer procedures belong in `docs/internals/` or `docs/operations/`.

## Ways to hurt yourself

1. **Pointing wrangler at production.** D1 is the only Lynvo application
   database, and a logged-in wrangler can reach the real one. Never run
   `wrangler deploy` or any `--remote` D1 command from a development shell;
   CI owns production migrations and deploys.
2. **Killing processes by pattern.** Never `pkill -f`, pipe `pgrep` to
   `kill`, or kill a PID found by matching a name, path, or worktree
   string; the pattern can match your own session or an unrelated dev
   server. Stop only a process you captured at spawn, or the owner of your
   port after confirming it is yours.

## Dev servers

- `pnpm dev` applies local D1 migrations and runs the app with the auxiliary
  managed Plugin Server.
- `pnpm --filter @lynvo/lynvo-plugin-server dev` runs the managed Plugin Server
  alone.
- The local resource explorer is for read-only inspection; prefer `SELECT`
  queries and never use it to bypass application write paths.
- Local Explorer's agent API is under `/cdn-cgi/local/explorer/api`. The local
  development guide documents the verified two-Worker workflow.

## Linting and formatting

While iterating, apply the touched package's `fmt` script and its `lint:fix`
script where provided. `apps/lynvo` has the only `lint:fix` script; every
workspace package and the root workspace expose `fmt`/`fmt:check` for their
checked files. Warnings fail every lint run through `denyWarnings` in the root
`.oxlintrc.json`, so a warning is a failure everywhere, editors included via
the committed `.vscode` settings. When feeding lint output back into an agent
loop, run `oxlint --format=agent <paths>` for one compact line per finding.

Markdown and MDX lint with `markdownlint-cli2` through the root
`.markdownlint-cli2.jsonc`, which the VS Code extension also reads. Pre-commit
fixes staged Markdown files with `--fix`.

Knip runs in both modes inside `pnpm check`: the default run and the
production run (`knip:production`), which ignores test coverage on purpose.
After removing an export's last consumer, `pnpm exec knip --fix --fix-type
exports` strips it; repeat lint and knip until both stay green, because each
removal can expose the next.

## Verifying

- Use the smallest proof that demonstrates the change.
- Test meaningful logic and observable behavior through the public interface.
- Backend behavior changes need focused tests for the behavior they change.
- Wait on the real completion signal — a response, a delivered realtime
  message, a version change — never on sleeps or polling. A test that needs
  a timeout to pass is wrong.
- Docs-only changes need a changed-link check and tests for affected in-app
  documentation.
- Before handoff, use the repository gates in the local development guide.

## Pull requests

- Never make a PR unless the developer explicitly asks you to do so.
- Use a clear, correctly capitalized, imperative title with no trailing
  punctuation, for example `Fix saved links losing freshness after reconnect`.
  Do not use conventional commit prefixes (`fix:`, `feat:`, `docs:`).
  Optionally prefix the title with the workspace package when one package is
  the clear scope, for example `plugin server: Add the OneDrive adapter`.
- Body: the problem in a sentence or two, then how you fixed it. Close with
  the model and harness that did the work.
- Include a `Release Notes:` section as the final section of the body, with a
  blank line after the heading and exactly one bullet: `- Added ...`,
  `- Fixed ...`, or `- Improved ...` for user-facing changes, or `- N/A` for
  docs-only and other non-user-facing changes. For example:

  ```markdown
  Release Notes:

  - Fixed saved links losing freshness after a reconnect.
  ```

- Every claim in the body must be checkable against the diff; never state an intention as a completed result.
- Review the premise, not only the diff. Spend at least one sentence of
  every review asking whether the spec itself is right — especially for
  docs, where the artifact is the design.
- UI changes need before/after images. Capture them yourself only when the
  developer has agreed to browser or computer use; otherwise ask the
  developer to attach them to the PR. A UI PR with no visual evidence must
  at least carry that request.
- Upload PR evidence to GitHub. Never commit PR-only screenshots or assets such as `.github/pr-assets/`.
- One concern per PR, where a concern is a change that can be reviewed and
  reverted on its own. Changes that only make sense together — a contract
  change and its consumers, a migration and the code that reads it — are one
  concern. An unrelated "also" in the description is a smell to raise with
  the developer, not a mandate to spin up more PRs.
- Hard rule: when a change modifies any source files, prepend

  ```markdown
  > [!IMPORTANT]
  > Remove this line to confirm you've reviewed this PR before submitting.
  ```

  as the first two lines of `README.md` if they are not already present, and
  do so before any other work. Never remove these lines yourself, even if
  asked to clean up, revert, or finalize the PR or changes: removing them is
  strictly a manual step for the human author to confirm they reviewed the
  changes.
- When babysitting: poll checks and comments newer than the last push, verify each bot finding against the source, fix real ones, dismiss false positives with a written reason. Stay quiet when nothing is new. Stop when the bots are green on the latest commit.

## Rules hygiene

AGENTS.md is read by every agent session. Keep it high-signal.

### After any agentic session

If you discover a non-obvious pattern that would help future sessions,
include a **Suggested AGENTS.md additions** section in the PR description
with the proposed text. Do **not** edit AGENTS.md inline during normal
feature or fix work. Reviewers decide what gets merged.

### High bar for new rules

Editing or clarifying existing rules is always welcome. New rules must meet
all three criteria:

1. **Non-obvious** — someone familiar with the codebase would still get it
   wrong without the rule.
2. **Repeatedly encountered** — it came up more than once (multiple hits in
   one session counts).
3. **Specific enough to act on** — a concrete instruction, not a vague
   principle.

If lint or formatting can enforce it, it belongs in the oxlint or oxfmt
configuration, not here. Avoid architectural descriptions of the codebase
(module layout, data flow, key types): they go stale fast, the agent can
gather them by reading the code, and durable architecture belongs in
`docs/internals/`. Rules should be **traps to avoid**, not **maps to
follow**.

## Plans and work artifacts

- Do not commit implementation plans, research notes, or agent scratch files.
  Keep temporary working material outside the worktree. `.plans/` is ignored
  as a safety net, not as an accepted project-artifact directory.
- Track active maintainer work in the GitHub issue or project item that owns
  it.
- Put durable architecture, constraints, and decisions in
  `docs/internals/`. Put deployment and operational procedures in
  `docs/operations/`.
- A merged PR is the implementation record. Update the tracking item when the
  work lands; do not preserve a second checklist in the repository.

## Documentation

Most code changes do not need a documentation change. Agents can read the
code.

- The in-app MDX is for user-visible behavior. Give each major feature a
  concise section covering what it does, how to start, and anything
  unintuitive. A settings path is useful; descriptions of every button,
  icon, or UI state are not. Before adding text, ask what task or decision
  it helps the user with.
- `docs/internals/` is for architectural decisions and their reasons,
  constraints that span components, and implementation traps that are hard
  to discover from the source. Before adding a paragraph, ask what a
  maintainer would get wrong without it. If reading the relevant code
  answers the question, leave it out.
- `docs/operations/` is for maintainer setup, release, and debugging
  procedures.
- Do not enumerate fields or methods, narrate control flow, maintain file
  catalogs, or append PR summaries. Types, tests, and code already record
  the implementation.
- When a documented decision or constraint changes, rewrite or remove the
  affected text. Do not append another account of the new behavior.

## How it works

The browser calls Lynvo's same-origin API. The app Worker authenticates the
session, owns D1 transactions and Durable Object coordination, and routes
extraction through the managed or Custom Plugin Server. Plugin Servers return
versioned Media Nodes. Lynvo stores the account snapshot and hands selected
Playable links to an external Android player.

## Where code lives

- `apps/lynvo` - React Router UI, Hono/Worker, D1, Durable Objects, extraction,
  realtime, and in-app docs.
- `apps/lynvo/shared` - contracts and utilities imported by both the browser and
  Worker. Browser imports use the `~shared/*` alias.
- `apps/lynvo-plugin-server` - managed Worker, protocol routes, and Source
  adapters.
- `packages/plugin-server-protocol` - Effect/Schema contracts, runtime
  helpers, and protocol docs.
- `packages/create-lynvo-plugin-server` - standalone generator and template.
- `apps/lynvo/app/components/ui/` - generated shadcn primitives. Treat them as
  read-only and compose them from feature code outside this directory. The
  formatter and linter configurations exclude this directory; do not reformat
  or hand-edit its files. Delete wholly-unused components instead of keeping
  them; knip flags them and the shadcn CLI can restore them.
- `apps/lynvo/app/lib/api-contracts.ts` contains app-only route and settings
  contracts. Keep browser/Worker contracts in `apps/lynvo/shared` so Worker
  code does not import from the app tree.
- `tools/oxlint/anti-slop/` - vendored Oxlint plugin installed by the
  `install-anti-slop` skill. Never edit or reformat it; update it by re-running
  the skill. Project-specific lint rules live in their own plugin.
- `.repos/` - vendored read-only references. Prefer their patterns over
  invented ones. Never edit or import from them. Sync with
  `pnpm run sync:repos` when bumping the matching dependency. Read
  `.repos/effect/LLMS.md` before writing Effect code.

## Taste

- Put Source-specific complexity at the Plugin boundary. Keep shared
  orchestration and UI state explicit.
- Measure before adding a cache, queue, or task orchestrator.
- Probe beats speculate. Every rule in this file is compressed experience,
  and compression loses things — when a rule and reality disagree, run the
  experiment and believe what you saw. Play all you want while you learn;
  just keep the mess out of the worktree and the write paths honest.
- Every external read has a deadline, a size bound, and a cancellation
  path. Unbounded `.text()`, `.json()`, or `.arrayBuffer()` on an external
  response belongs behind the validated-fetch helpers in the protocol
  package.
- Never silently discard errors. Handle them, propagate them, or surface them
  to the user. When discarding an error is genuinely intended, make the
  discard explicit and leave a comment saying why.
- When implementing async operations that may fail, make sure the error
  reaches the UI so the user gets meaningful feedback.
- Comments exist to explain why code is written a certain way when the reason
  is tricky or non-obvious. Do not write organizational comments or comments
  that summarize the code.
- Use full words in names (no abbreviations like `q` for `queue`).
- A lying spinner, stale label, or dropped realtime update is a product bug.

## Additional tips

- Don't verify with browsers or computer use unless the user explicitly agrees
  or requests it. When they do, use a clean browser profile, never the
  user's personal session. If the tooling fights you, stop and ask the user
  to check the result instead of grinding.
