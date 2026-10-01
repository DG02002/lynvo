# Developer docs writing guidelines

This guide captures the developer documentation house style. Its
patterns come from full-body reads of two sources in September and
October 2026: sixteen pages spanning every genre of a large deployment
platform's documentation — getting started, concepts, how-to guides,
CLI reference, REST reference, error reference, limits — and a GraphQL
API's developer site, read page by page and re-verified live. The
sources established the shape; this guide states it as the style to
write in.

Treat the sample examples in this guide as evidence of the style, not as
content to copy. Do not carry their product names, endpoints, options, or
feature claims into the product being documented. Replace their
substance with the verified behavior of the product being documented.

This is a developer-documentation guide, and it is project-agnostic: the
project's own mechanics — docs components, frontmatter contract,
navigation configuration, link validation, product terminology — are
discovered from the repository being documented, following the project
adaptation rules at the end of this guide. End-user product docs follow
the product-docs-writing skill, release notes and announcements follow
the product-changelog-writing skill, and formal policies follow the
product-policy-writing skill.

## Contents

- The developer docs style
- Voice and person
- Page openers
- Headings
- Code samples
- Reference pages
- Error and troubleshooting reference
- Guides and getting-started pages
- Conventions, concepts, and migrations
- Project adaptation rules
- Review checklist

## The developer docs style

Document one concern per page, ordered from "what is this" to "how do I
call it" to "what goes wrong". Recurring characteristics:

- A one- or two-sentence definition under the title, before any heading.
- Sentence-case headings: imperative for tasks, noun phrases or gerunds
  for concepts and reference material.
- Present tense, short declarative sentences, everyday words,
  contractions.
- Code-first: a claim that can be a working sample is a working sample,
  introduced by a colon lead-in.
- Fielded material in tables with short noun headers; defaults and enums
  inside the description column, not in prose around the table.
- Explicit defaults, explicit limits, and explicit negation — what does
  not happen.
- Error documentation that quotes the literal error text.
- Purposeful cross-linking on first mention; deep references linked,
  never duplicated.
- No screenshots; diagrams only when a flow needs one.

Length follows the concern: a convention page can be three paragraphs
and a pagination loop; an endpoint reference runs as long as its fields.
Do not pad.

## Voice and person

Write as the product talking to one implementer. Rules, with corpus
examples:

- Use "you" for the reader and their code. Use "we" only for the
  company's decisions. Prefer the endpoint, option, or feature as the
  subject.
  - "The `deploy` command deploys projects, executable from the
    project's root directory."
  - "We limit the amount of requests you make to our GraphQL API."
- Keep reference entries person-free with the capability formula: "The
  `--prod` option can be used to create a deployment for a production
  domain."
- Open procedural passages with purpose: "To download and install the
  CLI, run the following command:" — the reader knows why they are about
  to run something before they run it.
- Present tense for behavior; future tense only for consequences: "If
  the size of the source files exceeds this limit, the deployment will
  fail."
- Modality ladder: "must" for hard requirements, "We recommend" for
  opinionated guidance, "can" for capability. Never hedge.
- State what does not happen in the same breath as what does:
  - "Any change you make to environment variables is not applied to
    previous deployments; it only applies to new deployments."
- Contractions are welcome. No marketing voice: the corpus never uses
  "seamless", "powerful", or exclamation marks.
- Define a term in one sentence at its first mention on the page, then
  use it unchanged.

## Page openers

Every page, in every genre, opens with a definition or orientation
sentence directly under the title, before any heading. Patterns:

- Concept: "Environment variables are key-value pairs configured outside
  your source code so that each value can change depending on the
  environment."
- Reference: "All list responses from queries return paginated results."
- Integration: "Webhooks allow you to receive HTTP push notifications
  whenever data is created, updated or removed."
- New concept, named: "A Volume is persistent storage that you mount as
  a directory in a sandbox."

Overview pages add a second sentence stating scope: "This guide explains
what happens during that transformation, from the moment the platform
receives your code to when your application is ready to handle its first
request."

## Headings

- Sentence case, always.
- Imperative for how-to sections: "Install the CLI", "Create an
  integration", "Exchange `code` for an access token".
- Noun phrases or gerunds for concept and reference sections:
  "Deployment methods", "Rate limiting", "Installing dependencies",
  "Complexity limits".
- Bare names for reference entries: the option name, the operation name,
  the error code.
- Status plus description for response sections: "### 400: One of the
  provided values in the request body is invalid."
- Depth stays shallow: H2 for sections, H3 for entries, H4 only for
  variants of one thing. Questions are not headings.

## Code samples

Code is the medium; prose serves it. Conventions:

- Every code block is introduced by a lead-in sentence ending in a
  colon. The workhorse patterns:
  - "To get information about the authenticated user, you can use the
    `viewer` query:"
  - "To create a new issue, use a mutation:"
  - "You can initialize the client with the access token:"
- Follow a block with one interpretive sentence when the output needs
  reading: "This mutation will create a new issue and return its `id`
  and `title` if the call was successful (`success: true`)."
- Show a response only when it teaches something new — a shape, a
  status, an error field. Pairing every request with its response is
  noise; never pairing them hides the contract.
- Fences carry a language tag, and a filename or context attribute when
  the pipeline supports one. Show terminal output only when the output
  teaches something.
- No `$` prompt. Commands are bare and copy-pasteable.
- Placeholders: uppercase underscore for secrets and tokens
  (`YOUR_API_KEY`, `YOUR_ACCESS_TOKEN`), angle brackets for values
  (`<domain>`), realistic sample values for identifiers ("BLA-123", a
  real-shaped UUID).
- Name operations after their intent: `query Teams`, `query
  HighPriorityIssues`, `mutation IssueUpdate`. Anonymous blocks only in
  quick fragments.
- Comments inside code are purposeful, never decorative: "# Replace
  these values with the ID printed by the deploy command", "// Verify
  signature". No comments inside GraphQL samples — the lead-in sentence
  does that work.
- One language per block. Variants are sibling blocks with paired
  lead-ins ("Using async await syntax:" / "Or promises:") unless the
  project's pipeline renders tabs.
- Multi-line examples list real variants consecutively rather than
  describing the variants in prose.
- Configuration samples reference their schema:
  `"$schema": "https://example.com/config.json"`.
- Use before/after or allowed/not-allowed code pairs for configuration
  mistakes, instead of prose descriptions of the mistake.
- Response examples use realistic prefixed identifiers, not "123".

## Reference pages

Reference pages field a contract. Organize by concern, never as a tour.

### Endpoint or operation page

Skeleton, using only the parts that apply:

```markdown
# Operation name

One-sentence definition of what the call does.

[HTTP method + path block]

Behavior paragraph, including state transitions and side effects.

## Authentication

How this call authenticates.

## Query parameters

| Name | Type | Required | Description |

## Request body

Content type, required flag, schema or example.

## Example request

## Example response

## Responses

### 200: Description of success.

### 400: One of the provided values in the request body is invalid.
```

### CLI command page

Skeleton:

```markdown
# command-name

Definition sentence ("The `deploy` command deploys projects, executable
from the project's root directory.").

## Usage

Minimal invocation, no prompt symbol.

[Scenario sections such as "Deploying to a custom domain".]

## Options

One H3 per option.

## Global options

Anchored link list.
```

The option micro-format: what it does using the capability formula, one
example, an italic caption ("*Using the command from the root of a
project directory.*"), a note for caveats, and a "When not to use"
heading when misuse is common.

### Tables

- Parameter tables use `Name | Type | Required | Description`, Yes/No in
  Required, and behavior, enums, and defaults folded into the
  description: "`forceNew` | integer | No | Forces a new deployment even
  if a previous similar one exists. Defaults to `0`."
- Payload and header tables use two columns, `Field | Description` or
  `HTTP Header | Description`, code-formatted name on the left, one-line
  description on the right.
- Nullability and deletion caveats live in the description as prose:
  "May be null if the user that triggered the action has since been
  deleted."
- Explain a large table's columns in prose before the table, then give
  worked examples for numeric limits: "You are able to delete up to 60
  domains every 60 seconds. Should you hit the rate limit, you will need
  to wait another minute."
- Limits pages lead with the action path ("Request a limit increase")
  before any table, and values that need narrative get their own
  section.

### Schema ownership

The schema lives in one explorer or generated reference. Docs explain
conventions — pagination, filtering, auth, rate limits — and link to the
explorer. Do not maintain a hand-copied field list that a tool
generates.

## Error and troubleshooting reference

An individual error page has a fixed anatomy:

1. The title is the error code or its human name.
2. Definition sentence: "The BODY_TOO_LARGE error indicates that the size
   of the fallback body exceeds the maximum cache limit."
3. Occurrence context: "This error typically occurs in prerendered pages
   when..."
4. The HTTP status on its own line.
5. The literal error message as a code block, exactly as it appears in
   logs, so the page is greppable against real output.
6. A "Troubleshoot" section with bulleted remedies, each opened by a
   bolded imperative lead-in: "- Review response size: Examine the size
   of the response body for the affected page."
7. A prevention sentence: "To prevent this error, ensure that the size
   of the fallback page is less than 10 MB."

Error indexes use human problem names as headings ("Missing public
directory"), state the cause, then open remedies with "To resolve this
error, you can try the following steps:".

Always document the error shape as JSON, including behavior that
violates the reader's expectation: rate-limit errors that return 400
instead of 429, queries that partially succeed with a 200. State
partial-success semantics explicitly where they exist.

## Guides and getting-started pages

- Getting-started walks a motivated progression: each step exists
  because the previous step's output is needed (viewer → teams → the
  team's issues → create → update). Never a feature tour.
- Prerequisites are explicit — a bulleted section before the first
  action.
- Steps are numbered, imperative, one action per step, with UI elements
  bolded: "From your dashboard, select your project."
- Multi-step processes get a process-overview list before the detail,
  then one section per step.
- How-to sections open with purpose: "To verify your domain, point the
  domain to the platform by configuring nameservers or a DNS record."
- Getting-started closes with "Next steps" — bulleted links, each with
  an en-dash description: "- [Fundamental concepts](/docs/fundamentals)
  – How requests, builds, and compute work".
- Shared-API credibility is worth one sentence: "It's the same API we
  use internally."

## Conventions, concepts, and migrations

- Convention pages (pagination, filtering, rate limits, deprecations)
  are prose plus samples, organized by concern, and anchor new notation
  to a precedent the reader already knows: "Relay style cursor-based
  pagination", ISO 8601 durations. Never invent notation when the
  reader already has a mental model.
- Teach loops as narrative, not tables: query the first page, pass
  `pageInfo.endCursor` as `after`, repeat while `hasNextPage` is true.
  State defaults as facts: "The first 50 results are returned by
  default."
- Comparator and operator references group operators by type, with one
  minimal sample per operator, and call out edge semantics in prose
  ("an `every` filter also excludes issues with multiple labels,
  regardless of what they are").
- Migration guides are sibling before/after sections labeled by version,
  holding identical code with only the changed lines, introduced by one
  sentence: "Here is an example with the mutation to update a `User`."
- Deprecation policy states the mechanism (a `@deprecated` directive, a
  changelog prefix), the notice period, and whether affected developers
  are proactively contacted.

## Project adaptation rules

The patterns above are rendering-agnostic. Before writing, learn how the
repository being documented publishes developer docs: where pages live
and how navigation orders them, which frontmatter fields are required or
validated, which components render callouts, code figures, and tabs, and
what link validation runs and when. Follow those conventions exactly and
flag gaps instead of improvising new components or frontmatter fields.

Then map the style onto the project's mechanics:

- Variant code blocks use the project's tab component if one exists;
  otherwise paired sibling blocks stay.
- Code, terminal output, and HTTP exchanges go in the project's labeled
  code figure; never bare fences if a figure component exists.
- Notes and caveats become the project's callout component; if none
  exists, use the closest equivalent and flag the gap.
- Endpoints, options, fields, and error codes appear exactly as the
  source emits them, and product terms follow the project's glossary.
- If the project generates a reference from its schema, link it instead
  of restating fields.
- Every documented endpoint, error, and option traces to source; if the
  repository tests its documentation samples, run those tests and keep
  every sample passing.

## Review checklist

- A definition sentence opens the page before any heading.
- Headings are sentence case; imperative only for tasks.
- Every endpoint, field, option, error code, and default is verified
  against source.
- Every code block has a colon lead-in; no prompt symbols; placeholders
  are consistent; operations are named after their intent.
- Request/response pairs appear where the response teaches; error shapes
  appear as JSON.
- Tables use Name/Type/Required/Description or Field/Description;
  defaults and enums live in descriptions.
- Defaults, limits, and explicit negations are stated.
- Errors quote the literal message and stay greppable.
- Cross-links resolve under the project's validation; deep references
  are linked, not duplicated.
- No screenshots, no marketing voice, no corpus terminology leaked in.
- The project's components, frontmatter, and formatting conventions are
  followed; gaps are flagged, not improvised.
