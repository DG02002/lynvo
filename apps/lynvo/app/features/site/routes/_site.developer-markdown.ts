import { createDocsMarkdownLoader } from "~/features/site/docs/docs-section-routes"

const developerMarkdownLoader = createDocsMarkdownLoader("developer")

export function loader(
  parameters: Parameters<typeof developerMarkdownLoader>[0]
) {
  return developerMarkdownLoader(parameters)
}
