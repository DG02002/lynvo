import type { HighlighterCore } from "shiki/core"

let highlighterPromise: Promise<HighlighterCore> | undefined

// The dialog renders rarely and off the critical path, so the highlighter
// (core + JSON grammar + the docs' two themes) loads only on first open.
const getLogJsonHighlighter = (): Promise<HighlighterCore> => {
  highlighterPromise ??= (async () => {
    const [
      { createHighlighterCore },
      { createJavaScriptRegexEngine },
      githubLightDefaultTheme,
      githubDarkTheme,
      jsonLang,
    ] = await Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
      import("@shikijs/themes/github-light-default"),
      import("@shikijs/themes/github-dark"),
      import("@shikijs/langs/json"),
    ])
    return createHighlighterCore({
      themes: [githubLightDefaultTheme.default, githubDarkTheme.default],
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
      themes: {
        light: "github-light-default",
        dark: "github-dark",
      },
    })
  } catch {
    return undefined
  }
}
