# Lynvo writing system

This reference applies to project-owned, user-facing Lynvo content. It is
based only on:

- `docs/apple-HIG/Writing - Apple HIG.md`
- `docs/apple-HIG/Writing Inclusively - Apple HIG.md`

## Voice

Lynvo is direct, calm, practical, and technically trustworthy. Explain the
next action without blame, unnecessary excitement, jokes, or false certainty.

## Tone by context

- Routine actions are concise and neutral.
- Success messages are brief and affirmative.
- Recoverable errors are calm, specific, and action-oriented.
- Destructive actions state the consequences explicitly.
- Security language is precise without revealing sensitive account
  information.
- Marketing is confident and concrete, without absolute or unsupported claims.
- Developer documentation defines technical terms before using them.
- Policies use plain language without weakening legal meaning.

## Language patterns

- Use `Log in` as the authentication verb, `login` as a noun or adjective, and
  `Log out` as the opposite action.
- End loading labels with an ellipsis (`…`).
- Begin button and link labels with a verb when practical.
- Name the failed action in an error and provide a useful recovery step.
- Explain the current state and the next available action in an empty state.
- Give every form field a persistent label. Use placeholders only for examples
  or format hints.
- Use sentence case for headings, buttons, dialogs, statuses, and settings
  labels unless a proper name requires capitals.
- Avoid unnecessary `we`, `our`, `my`, and `your`. Name Lynvo or the object when
  that is clearer.
- Use device-appropriate verbs. Avoid layout-dependent directions such as
  `above` and `below`.
- Describe what happens instead of requiring a particular sense.
- Avoid jargon, gendered terms, ableist language, idioms, and colloquial
  expressions. Use implementation terms only when the audience needs them.

## Review checklist

Before shipping copy, read it aloud and verify that it:

1. Leads with the most important information.
2. Uses the established term for each object and action.
3. Identifies a useful next step when action is required.
4. Remains understandable outside the visual layout and screen-reader context.
5. Can be localized without relying on wordplay or culture-specific idioms.
