import { data } from "react-router"

import type { Route } from "./+types/_site.docs-markdown"
import { docsCatalog } from "~/features/site/docs/docs-catalog"

export const loader = ({ params }: Route.LoaderArgs) => {
  const slug = params["*"]
  const markdown = slug ? docsCatalog.getMarkdown(slug) : undefined

  if (!markdown || !slug) {
    throw data(null, { status: 404 })
  }

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `inline; filename="${slug.replaceAll("/", "-")}.md"`,
    },
  })
}
