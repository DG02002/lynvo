# Docs writing guidelines

This guide captures the writing and structure of Linear's product
documentation (linear.app/docs), sampled across 41 pages in September 2026
covering start guides, feature pages, settings pages, integrations, security,
API, and concept pages. It adapts that style to Lynvo's in-app MDX docs.

Treat the Linear pages as evidence of a house style, not as content to copy.
Do not carry Linear's product names, screenshots, settings paths, pricing, or
feature claims into Lynvo docs. Replace their substance with verified Lynvo
behavior.

This is a user-documentation guide. Formal policies follow the
product-policy-writing skill instead. Architecture and maintainer procedures
belong in `docs/internals/` and `docs/operations/`, not in these pages.

## The sample-derived docs style

Linear documents one feature per page, ordered from "what is this" to "how do
I do each task with it" to "what goes wrong". Across the corpus, recurring
characteristics include:

- A short title of one to three words: a feature noun ("Cycles", "Search",
  "Favorites", "Insights") or a verb phrase ("Create issues", "Invite
  members", "Edit issues").
- A one-sentence lede directly under the title that states what the feature
  does for the user, before any image or heading.
- A screenshot of the feature immediately after the lede, on almost every
  page.
- A fixed section skeleton in this order, using only the parts that apply:
  `## Overview`, `## Configure`, `## Basics` (or feature-specific task
  sections), `## FAQ`.
- Task sections with verb-first headings ("Open views", "Create views",
  "Edit views", "Share views", "Add favorites", "Remove favorite"), ordered
  from open/create through edit/share to niche tasks.
- A reader voice that uses "you", and a maker voice that uses the product
  name or "we" for what the system does.
- Present tense, short declarative sentences, everyday words, contractions.
- Explanations of why a behavior exists, not just what it does.
- Honest statements of limits and irreversibility, stated plainly and early
  enough to act on.
- Notes for caveats, limits, and availability, set off from body text.
- Collapsible FAQ blocks holding real user questions, edge cases, and
  troubleshooting.
- Cross-links on first meaningful mention plus a "Read more on [topic]"
  sentence at the end of concept sections.
- Numbered steps for sequential procedures, bullets for options and
  enumerations, tables for parameters and comparisons, fenced code only for
  literal commands and configuration.

Page lengths run from roughly 250 to 1,500 words. Small features get short
pages; the start guide and integrations run longest. Do not pad a small
feature to a fixed length.

## Voice and person

Write as the product talking to one user. Rules, with corpus examples:

- Use "you" for the reader and their actions. Use "Lynvo" or "we" for what
  the system does. Never "the user" in body text.
  - "You can always edit cycle configurations in the future."
  - "Linear automatically creates upcoming cycles for your team."
- Prefer the system as the actor for automatic behavior: "Lynvo stores the
  key encrypted and does not send it to the browser."
- Use "You can…" to introduce a capability list, then bullets.
- State why, in the same breath as what:
  - "The goal of cycles having repeated intervals is to help you avoid the
    busywork associated with optimizing cycle timing and instead focus on
    shipping."
- State limits and irreversibility plainly, without apology or hedging:
  - "There is no way to keep unfinished issues in a closed cycle."
  - "This setting isn't self-serve to change later."
  - "Past cycle dates cannot be changed."
- Prefer "must" for requirements ("You must be a Linear admin to complete
  this step") and "can" for capabilities. Avoid "should" for system rules.
- No marketing voice. The strongest promotional move the corpus makes is a
  concrete benefit in the lede. Ban "powerful", "seamless", "simply",
  "easily", "revolutionary", and exclamation marks.
- Contractions are welcome ("you'll", "doesn't", "can't"). Em dashes appear
  in enumerations ("You can favorite many items in Linear — including
  issues, projects, views … — to keep them easy to access from the
  sidebar").
- Define a term in the lede or Overview the first time a page uses it, in
  one sentence, then use that term unchanged.

## Title and lede formulas

The lede is one sentence, no heading, before the first image. Corpus
patterns, strongest first:

- Noun definition with benefit: "Cycles are a practice to keep up your
  team's momentum, similar to commonly used agile-flavored sprints."
- Imperative benefit: "Automate SLAs for issues that should be completed
  within a certain amount of time."
- "You can" enumeration: "You can favorite many items in Linear — including
  issues, projects, views, documents … — to keep them easy to access from
  the sidebar."
- Capability summary: "Quickly find issues, projects and documents with
  Search."
- Scale statement for core actions: "Creating issues is the most common
  action taken in Linear."

Pick one pattern; never stack two. The Lynvo `description` frontmatter field
carries the same sentence or a tightened version of it.

## Page anatomy

The canonical skeleton, in order. Omit sections that do not apply; do not
invent new top-level sections when a task heading fits inside Basics.

```mdx
---
title: Feature name
description: One-sentence lede.
navLabel: Feature name
contentType: How-to
---

<DocSection id="overview">

## Overview

![Descriptive alt text](screenshot)

One to three short paragraphs: what the feature is, what it is for, and
when to use it. Optionally a "You can:" bullet list of capabilities.
Links to settings and related pages on first mention.

</DocSection>

<DocSection id="configure">

## Configure

Where the setting lives and who can change it. Numbered steps for
multi-step setup. Permission or prerequisite statements.

</DocSection>

<DocSection id="basics">

## Basics

### Verb-first task

Steps or a short explanation.

</DocSection>

<DocSection id="faq">

## FAQ

One block per real question.

</DocSection>
```

Rules per section:

- **Overview** answers "what is this and when do I use it". It never
  contains steps. It may contain a "might represent:" or "is typically used
  to:" bullet list of concrete situations, in the user's vocabulary.
- **Configure** is the first place a settings path appears. Open with the
  path and the primary toggle in one sentence: "Configure cycles under
  **Team Settings > Cycles**. Turn on the toggle for **Enable cycles**."
  State permission needs ("You must be a workspace admin…") and
  prerequisites before the steps.
- **Basics** holds one H3 per task. Order tasks: open/create, then edit,
  then share, then niche. Headings start with a verb and name the object:
  "Add a Proxy key", "Open a Saved link on your TV", "Remove a Plugin".
- **FAQ** holds real questions in the user's words. Direct answer in the
  first sentence, then context and the fix. Include the questions support
  actually receives: error messages, limits, "why don't X and Y match",
  troubleshooting a broken setup.

### Interaction-mode subsections

When a task has keyboard, pointer, and menu paths, Linear gives each its own
H3 under Basics and lists them as parallel shortcuts:

```mdx
### Keyboard

`/` to search all issues in the workspace by title, description, comments

### Mouse

* Select the magnifying-glass button next to the _New Issue_ button

### Command menu

`open issue` to launch quick issue search
```

Apply this to Lynvo surfaces that have more than one input path (TV remote
versus phone versus browser). Skip it where only one path exists.

## Formatting conventions

- **Settings paths in bold with `>` separators**, linked to the real route:
  `Open [**Settings > Proxy**](/settings/proxy)`. Capitalize as the app's
  navigation renders it. Never write a settings path in prose without bold.
- **Buttons, toggles, and menu items in bold** on first use:
  **Add Custom Plugin Server**, **Enable cycles**. Deep menu items may be
  italic with an ellipsis as the UI shows: _Edit view…_, _Make recurring…_.
- **Keyboard shortcuts in backticks**, platform-prefixed:
  `Cmd/Ctrl` + `K`, `Option/Alt` + `C`, `O` then `F`.
- **Notes** for caveats, limits, and availability — one to three sentences,
  set off from body text. In Lynvo, use `<DocsNote title="Note">` (see the
  adaptation rules below). Typical uses:
  - a limit with a number: "Drafts are stored for 6 months before being
    deleted automatically."
  - irreversibility: "Once you change the start date you cannot revert this
    change."
  - a behavior that looks like a bug but is intended, with the reason.
  - a pointer to the feature that covers an adjacent need.
- **Numbered steps**: each step starts with a verb, one action per step,
  parallel structure, and names the exact UI element to act on. Settings
  navigation folds into one step when trivial ("Navigate to **Settings >
  General** and enable the toggle.") and expands when the flow has
  decisions.
- **Bullets** for options and enumerations; keep each bullet to one line or
  two. Bullet lists may be lowercase fragments when they complete a lead-in
  sentence ("A team can define:").
- **Tables** for parameters, permissions, and comparisons — for example a
  Custom Plugin Server manifest field table or a player support matrix.
  Give every column a short header.
- **Code** only for literal commands, file contents, and HTTP exchanges, in
  a labeled `CodeBlock`. Never use code formatting for emphasis or UI
  labels.
- **Images**: every page that describes visible UI gets a screenshot of that
  UI. Alt text describes what the screenshot shows, including state:
  "Settings > Proxy showing a saved Scrape.do key and the per-server usage
  toggle." Where the screenshot needs interpretation, add an italic caption
  line under it: "*At Risk projects*". Annotate screenshots sparingly; prefer
  a crop that needs no annotation.
- **Videos**: embed a short clip only when a flow is hard to follow from
  stills, and keep the surrounding text self-sufficient.

## Cross-linking

- Link the first meaningful mention of any feature or settings page, using
  its real route. The docs catalog fails the build on broken `/docs/...`
  links and heading anchors, so verify every link.
- End concept sections with a "Read more on [topic](url)." sentence.
- Link out to player documentation, Scrape.do, or Cloudflare docs when the
  user must act there; never duplicate their full instructions.
- When two pages could answer a question, pick one home for the answer and
  link from the other. Do not maintain two copies.

## Page-type templates

### Feature how-to page

The canonical skeleton above. This is the default for Lynvo user surfaces:
saving links, player selection, proxy keys, settings pages, Remote Play as
its own page. Include screenshots for every Configure and Basics step that
involves visible UI.

### Concept page

For "what is X" pages (what is a Plugin Server, what is a Source). Pattern
from Linear's Concepts page: definition paragraph, then one H2 per concept
with a short definition, a "can:" or "might:" bullet list of concrete
situations, and "Read more on [page]" at the end. Close multi-concept pages
with a "How these fit together" section of one-line summaries:

```mdx
- Saved links hold the URLs you choose
- Plugin Servers resolve them into Media Nodes
- players receive the Playable link you select
```

### Integration or setup page

For connecting something external: Custom Plugin Servers, proxy keys,
generating a standalone Plugin Server project. Pattern from Linear's Slack
and GitHub pages: lede states the pairing's benefit, brand or architecture
image, Overview with a capability table or bullets, Configure with
permissions and numbered steps, then one H2 per capability the connection
gives you, then FAQ. State trust and data-flow facts explicitly (where the
API key lives, what the server can and cannot reach).

### Reference page

For contracts users implement against: the Plugin Server Protocol pages,
which follow Linear's developer-docs shape rather than the feature
skeleton. Keep Lynvo's existing Reference style — precise, fielded, tables
and labeled code blocks, structured errors — and apply Linear's developer
conventions: organize sections by concern ("Endpoint", "Authentication",
"Error handling"), show a working request sample for every endpoint
(HTTP first, SDK second), state recommendations inline ("we recommend"),
and link deep external references (Effect, Cloudflare Workers, Hono)
instead of duplicating them. Add a one-paragraph Overview at the top and
cross-links to the surrounding tutorial pages; reference pages otherwise
stay terse, with no screenshots.

### Start guide

One page that takes a new user from zero to a working flow: what Lynvo is
for in two sentences, the recommended path as numbered steps, links into
the feature pages for depth, and a short FAQ. Do not duplicate feature-page
detail here.

## Information architecture and organization

Linear's documentation is three surfaces sharing one layout shell and one
sidebar footer:

- **User docs** (`linear.app/docs`) — one page per product feature for
  people using Linear.
- **Developer docs** (`linear.app/developers`) — organized by the thing you
  build with: GraphQL API, Authentication, Agents, TypeScript SDK, Guides.
- **Learn** (`linear.app/learn`) — a course library ("Intro to Linear",
  "Daily workflows"), not reference material.

The sidebar footer cross-links all three plus Contact support from every
page, so a reader can hop between using, building, and learning without a
global nav.

### User docs sidebar organization

The user docs sidebar is grouped and ordered as: Getting started, Account,
AI, Your sidebar, Teams, Issues, Issue properties, Projects, Initiatives,
Cycles, Views, Find and filter, Linear Asks, Integrations, Analytics,
Administration, Importers. The ordering encodes a reader journey, not an
architecture diagram:

1. Onboarding first (Start Guide, Concepts, Download).
2. Personal setup (Account, your sidebar experience).
3. Core work objects in increasing scope (issues → projects → initiatives),
   each with its properties and variations as adjacent groups.
4. Navigation and power use (Views, Find and filter).
5. Incoming work from outside (Asks).
6. Connections to other tools (Integrations).
7. Analysis (Analytics), then administration, then migration last.

Group rules:

- Groups are short noun phrases naming the object or area ("Issues",
  "Views", "Analytics"), occasionally a terse verb phrase ("Find and
  filter").
- A group that names a product object leads with a same-named overview page
  ("Teams" group → "Teams" page), followed by sub-topics, then adjacent
  pages.
- A page may appear in multiple groups where readers would reach it from
  different directions: "MCP server" sits under AI, Integrations, and
  Linear Asks; "Triage" sits under Teams and Views. Cross-listing is a
  deliberate discovery aid, not duplication — there is still one page.
- Landing pages are curated, not exhaustive: a one-line site description,
  a "Popular" card row, and a "Linear basics" card row, each card carrying
  a title and a one-sentence description.
- Breadcrumbs above the page title name the group ("Issues → Create
  issues"), and prev/next pagination follows the sidebar order.

### Developer docs organization

Developer pages keep the same voice but organize by build concern, not by
the Overview → Configure → Basics skeleton:

- Sidebar groups name the capability you build with: GraphQL API,
  Authentication, Agents, TypeScript SDK, Guides.
- Pages are reference-shaped with concern sections ("Endpoint",
  "Authentication", "Error handling") and working code samples for every
  request shown — curl first, SDK second.
- Recommendations are inline and opinionated: "If you're building an
  application for others to use, we recommend you use OAuth2."
- Deep references link out with an external marker (the GraphQL schema on
  Apollo Studio, the SDK on GitHub) instead of being duplicated. The
  developer landing page uses the same card pattern plus a Resources strip
  (changelog).
- No screenshots; diagrams only when the flow needs one.

### Lynvo section plan

Map Lynvo onto the same two-shape structure (Learn has no Lynvo equivalent
yet):

- **User docs** — ordered by the reader journey:
  - *Getting started*: Start guide, Concepts (Saved links, Sources, Media
    Nodes, players), Android TV setup.
  - *Link library*: Saving links, link selection and Playable links,
    players and player selection, Remote Play.
  - *Sources and Plugins*: What is a Source, managed Plugins, connecting a
    Custom Plugin Server from Settings, Proxy keys.
  - *Settings and account*: Settings surfaces, sign-in and sessions.
- **Developers** — the current Plugin Server pages, grouped by what you
  build with (Getting started, Build a Plugin Server, Protocol reference,
  Test and deploy, Build with an agent).

Placement rules:

- A user-facing how-to for a developer artifact ("add your Custom Plugin
  Server in Settings") lives in user docs and links into the developer
  section; the developer section holds only what an implementer needs.
- Both sections share the docs shell, sidebar footer cross-links, and
  prev/next order.
- Link out to deep external references (Effect, Cloudflare Workers,
  Hono, Scrape.do) rather than duplicating them; mark them as external.

## Lynvo adaptation rules

### Components and pipeline

Lynvo's MDX pipeline differs from Linear's Markdown. Map every Linear
pattern:

- `> [!NOTE]` callouts become `<DocsNote title="Note">` with the same
  content rules. Lynvo has no warning/tip variants; if a page needs a
  destructive-action warning, use `<DocsNote title="Warning">` with a title
  that names the risk.
- Linear's collapsible `<details><summary>` FAQ blocks have no Lynvo
  component yet. Until one exists, render each FAQ as a bold question
  line followed by the answer paragraph, inside one `## FAQ` DocSection.
  Flag to the developer that a collapsible component is part of the target
  style.
- Every H2 topic sits inside `<DocSection id="...">` with a stable,
  lowercase-hyphen id; heading anchors and cross-page `#anchor` links must
  match it.
- Code, terminal output, and HTTP exchanges go in `<CodeBlock label="...">`
  figures, never bare fences.
- Markdown links to internal `/` routes render as in-app links
  automatically; write plain Markdown links and let `DocsLink` handle them.

### Frontmatter

All four fields are required and validated: `title` (short, follows the
title formulas), `description` (the lede or its tightened form),
`navLabel` (sidebar label, usually identical to title), and `contentType`
of `Tutorial`, `How-to`, `Reference`, or `Conceptual`. Feature pages are
`How-to`; "what is" pages are `Conceptual`; step-by-step operator guides
are `Tutorial`; contract pages are `Reference`.

### Navigation

Sidebar structure lives in the `meta.json` files (one per docs section)
whose `groups[].pages` arrays define both the sidebar order and the
prev/next sequence. The catalog enforces that every page appears exactly
once in navigation — Linear instead cross-lists one page in several groups
where readers would look for it from different directions. Until the
catalog grows cross-listing support, achieve the same discoverability with
a "Read more on" link in the related group's pages, and raise cross-listing
with the developer when a page genuinely serves two audiences.

### Product terms

Use the product terms from `CONTEXT.md` exactly: Saved link, Source,
Plugin, managed Plugin Server, Custom Plugin Server, Plugin Server
Protocol, Media Node, Playable link, Remote Play. Players are Just (Video)
Player, VLC for Android, MPV, MX Player. Do not invent synonyms ("item",
"media entry", "addon") and do not generalize a term when a specific one
exists.

### Settings paths

Real routes, rendered as the app shows them: **Settings > Proxy**
(`/settings/proxy`), **Settings > Plugins** (`/settings/plugins`),
**Settings > Player** (`/settings/player`). Verify the navigation label and
the route before writing either; a renamed setting with an old path is a
broken doc.

### Coverage

Before calling a docs change done, walk the entry-point list from
`AGENTS.md` and make a per-surface decision: Save, settings, Plugin
configuration, link selection, Remote Play, in-app docs. Changes that touch
link resolution need a decision per Source adapter. Reverse states (retry,
refresh, reconnect, reopen, remove, cancel, sign out) get a step or an FAQ
entry on the page that owns the forward state.

## Review checklist

- Title is one to three words and follows a corpus formula.
- Lede is one sentence and states the benefit; `description` matches it.
- A screenshot follows the lede, and every step with visible UI has one.
- Sections follow Overview → Configure → Basics → FAQ; task headings are
  verb-first and ordered open/create → edit → share → niche.
- Every settings path is bolded, linked, and verified against the app.
- Every limit, number, and irreversible behavior is stated in a note or the
  relevant step, not discovered later.
- FAQ questions are real user questions with direct first sentences.
- Every cross-link resolves; the page appears exactly once in its
  `meta.json` navigation group.
- Product terms match `CONTEXT.md`; no Linear terminology leaked in.
- No marketing voice, no hedging, no stacked lede patterns.
