---
name: developer-docs-writing
description: >-
  Draft or review developer documentation in the code-first developer
  docs voice: definition-sentence openers, colon lead-ins into working
  request and response samples, fielded parameter tables, and greppable
  error references. Use for API, protocol, SDK, and CLI reference pages,
  developer guides, and migration notes — not for end-user product docs
  or changelog entries.
---

# Developer docs writing

Create or review developer documentation in the docs house style captured
in this skill's reference. Developer docs are for people implementing
against the product's APIs, protocols, SDKs, or CLIs. End-user product
docs follow the product-docs-writing skill, and release notes or
announcements follow the product-changelog-writing skill. Project
mechanics — docs components, frontmatter, navigation, product terms —
come from the repository being documented, not from this skill. This
skill does not decide what the contract is; it documents verified
behavior from source.

## Process

1. Define the request.

   Identify the page type (getting started, concept, how-to guide,
   endpoint or operation reference, CLI command reference, error
   reference, limits, migration), the surface it documents (API,
   protocol, SDK, CLI, webhook), the audience, and whether the request is
   to draft, revise, or review. If the page serves people using the
   product rather than implementing against it, route it to the
   product-docs-writing skill instead.

   Completion criterion: the deliverable has a documented page type,
   surface, and audience, or the unresolved choice is visible.

2. Ground the work in the contract.

   Verify every claim against the actual source before writing it:
   routes, schemas, protocol definitions, error codes, defaults, limits.
   Run the commands or read the tests that prove the behavior. Never
   invent an endpoint, field, type, or error code, and never carry a
   corpus sample's placeholder data into the page as if it were real
   behavior.

   Completion criterion: every endpoint, field, parameter, error code,
   and limit matches the source or is marked for confirmation.

3. Route to the reference and the project's docs setup.

   Read [the developer docs writing
   reference](references/developer-docs-writing-guidelines.md) before
   drafting or reviewing. Apply its voice, page skeletons, code sample
   conventions, and reference patterns. Then follow its project
   adaptation rules to learn the repository's docs pipeline: rendering
   components, frontmatter contract, navigation configuration, link
   validation, and product terminology.

   Completion criterion: every planned section follows the applicable
   reference guidance and the project's mechanics.

4. Produce the requested work.

   Open with a definition sentence, introduce every code block with a
   colon lead-in, pair requests with responses where the response teaches
   something, and field parameters into tables. State defaults, state
   what does not happen, and document the error shape.

   Completion criterion: the draft reads in the house voice with verified
   substance and passing links.

5. Finish with checks.

   Apply the reference's review checklist. Run the project's formatter
   and lint scripts. Confirm the page appears in the navigation
   configuration as that project requires, and that its docs link
   validation passes.

   Completion criterion: checklist complete or unresolved items listed.

## Return format

Return:

1. The requested draft or review findings.
2. The page type, surface, and skeleton used.
3. Unverified contract facts.
4. Navigation or cross-link changes.
5. A status such as "Draft ready for review."
