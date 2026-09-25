import { createDocsMarkdownLoader } from "~/features/site/docs/docs-section-routes"

const docsMarkdownLoader = createDocsMarkdownLoader("user")

export function loader(parameters: Parameters<typeof docsMarkdownLoader>[0]) {
  return docsMarkdownLoader(parameters)
}
