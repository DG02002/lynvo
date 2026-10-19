# TV Bro-specific UI

The TV Bro profile keeps Lynvo usable in the TV Bro Android TV browser, where
filters and long-URL entry are costly. Production detection uses TV Bro's
native `window.TVBro` bridge. Development builds also recognize the `TV Bro/`
user-agent and the per-browser **Use TV Bro-specific UI** setting. See
[the development preview instructions](development.md#test-tv-bro-specific-ui).

## Current differences

- `apps/lynvo/app/tv-bro.css` disables expensive visual effects, uses filter-free enter
  animations, caps the enter stagger, and adjusts device sign-in layout in
  landscape. Every rule is scoped by
  `html[data-lynvo-client-profile="tvbro-android-tv"]`.
- `apps/lynvo/app/lib/client-profile.ts` exposes the profile and view-transition hooks.
  Navigation links use `useViewTransition()` to disable view transitions.
- `TVBRO_FILTER_FREE_ENTER_CLASS` in
  `apps/lynvo/app/components/save-list/save-list-motion-constants.ts` opts
  animated Library elements into the filter-free animation rules.
- The Library hides its save input through a `useIsTvBroAndroidTv()`
  conditional. Keep React-side profile branches rare.
- The Gallery view is the default Library presentation under the profile in
  `apps/lynvo/app/features/site/settings/media-view-preference.ts`, and the
  device label is TV Bro-specific in `apps/lynvo/app/lib/device-name.ts`.

The Google sign-in page keeps its centered stacked layout in landscape. Its
current max-width stack contains the brand link, heading, sign-in actions, and
policy links; it does not need the obsolete generic auth-form grid. Revisit
this only if a live TV review shows the stack is difficult to use.

## Where to add a difference

| Kind of change | Mechanism |
| --- | --- |
| Visual effect, spacing, or layout | Add a scoped rule in `apps/lynvo/app/tv-bro.css`. |
| Disable a navigation view transition | Use `useViewTransition()` at the link or navigation call site. |
| Use a cheaper enter animation | Apply `TVBRO_FILTER_FREE_ENTER_CLASS` to the animated element. |
| Render or hide a control | Use `useIsTvBroAndroidTv()` only when CSS cannot express the difference. |
| Change a default or device label | Branch in the owning preference or device-name module, not in a leaf component. |

Prefer CSS and shared constants over React conditionals. Every TV Bro CSS rule
must retain the profile attribute prefix.
