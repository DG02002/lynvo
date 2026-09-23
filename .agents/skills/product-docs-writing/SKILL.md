---
name: product-docs-writing
description: >-
  Draft or review Lynvo in-app documentation pages in the Linear-style product
  docs voice: task-first page anatomy, plain confident sentences, verified
  settings paths, screenshots for UI features, and FAQ blocks.
---

# Product docs writing

Create or review Lynvo's user-facing in-app documentation in the house style
derived from Linear's product docs. This skill organizes the work. The
reference holds the detailed, sample-derived style guidance and the Lynvo
component and terminology mapping. This skill does not decide what features
exist; it documents verified product behavior.

## Process

1. Define the request.

   Identify the page type (feature how-to, concept, integration or setup,
   reference), the feature or surface, the audience (new user, Android TV
   user, Plugin Server operator), and whether the request is to draft, revise,
   or review. Decide which section owns the page — user docs for people
   using Lynvo, developer docs for people implementing against the Plugin
   Server Protocol — and which navigation group and position, using the
   information architecture rules in the reference. Check the page against
   the entry-point list in the reference; a change that touches a surface
   usually needs a decision for that surface's page, even if the decision
   is that it does not apply.

   Completion criterion: the deliverable has a documented page type, scope,
   and audience, or the unresolved choice is visible.

2. Ground the work in the product.

   Verify behavior against the running app or source before writing it:
   exact settings paths and routes, toggle names, player names, limits, and
   reverse states (retry, remove, cancel, sign out). Quote UI labels as the
   app renders them. Do not invent screens, limits, or shortcuts. Where a
   screenshot is required, confirm the screen exists and state what it must
   show rather than fabricating a description.

   Completion criterion: every UI path, label, and behavioral claim matches
   the app or is marked for confirmation.

3. Route to the reference.

   Read [the docs-writing reference](references/docs-writing-guidelines.md)
   before drafting or reviewing. Apply its page anatomy, section patterns,
   voice and sentence patterns, and formatting conventions to every page.
   Apply its information architecture rules when deciding where a page
   lives and how sections are grouped. Then read the section for the page
   type being written and the Lynvo adaptation rules for components,
   frontmatter, navigation, and product terms.

   Completion criterion: every planned section follows the applicable
   reference guidance.

4. Produce the requested work.

   Draft in the Linear-derived voice: one-sentence lede, Overview first,
   Configure before Basics, verb-first task headings, honest limits in
   notes, FAQ for real edge cases. Use Lynvo's MDX components and product
   terms as the reference maps them. Every cross-link must resolve; the
   docs catalog fails the build on broken `/docs/...` links, heading
   anchors, and missing navigation entries.

   Completion criterion: the draft reads in the house voice with verified
   substance and passing links.

5. Finish with checks.

   Apply the reference's review checklist. Run the touched package's `fmt`
   and lint scripts. Confirm the page appears once in its `meta.json`
   navigation group and the changed-link validation passes.

   Completion criterion: checklist complete or unresolved items listed.

## Return format

Return:

1. The requested draft or review findings.
2. The owning section, navigation group, page type, and skeleton used.
3. Unverified product facts and needed screenshots.
4. Navigation or cross-link changes.
5. A status such as "Draft ready for review."
