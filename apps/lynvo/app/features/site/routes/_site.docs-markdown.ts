import type { DocsRouteParams } from "~/features/site/docs/docs-section-routes"
import { createDocsMarkdownLoader } from "~/features/site/docs/docs-source.server"

export function loader(parameters: DocsRouteParams) {
  return createDocsMarkdownLoader("user")(parameters)
}
