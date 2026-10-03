import type { HighlighterCore } from "shiki/core"

import { DOCS_SHIKI_THEMES } from "~/lib/shiki-theme-names"

let highlighterPromise: Promise<HighlighterCore> | undefined

// The dialog renders rarely and off the critical path, so the highlighter
// (core + JSON grammar + the docs' two themes) loads only on first open.
const getLogJsonHighlighter = (): Promise<HighlighterCore> => {
  highlighterPromise ??= (async () => {
    const [
      { createHighlighterCore },
      { createJavaScriptRegexEngine },
      nightOwlLightTheme,
      houstonTheme,
      jsonLang,
    ] = await Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
      import("@shikijs/themes/night-owl-light"),
      import("@shikijs/themes/houston"),
      import("@shikijs/langs/json"),
    ])
    return createHighlighterCore({
      themes: [nightOwlLightTheme.default, houstonTheme.default],
      langs: [jsonLang.default],
      engine: createJavaScriptRegexEngine(),
    })
  })()
  return highlighterPromise
}

/**
 * Highlights a JSON document with the docs' dual themes; the dark variant
 * rides along as CSS variables that app.css swaps in. Returns undefined
 * when highlighting is unavailable so callers can render plain text.
 */
export const highlightLogJson = async (
  code: string
): Promise<string | undefined> => {
  try {
    const highlighter = await getLogJsonHighlighter()
    return highlighter.codeToHtml(code, {
      lang: "json",
      themes: DOCS_SHIKI_THEMES,
    })
  } catch {
    return undefined
  }
}
