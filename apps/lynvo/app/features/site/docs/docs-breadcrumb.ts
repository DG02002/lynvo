import { useRouteLoaderData } from "react-router"

import type { DocsLoaderData } from "./docs-section-routes"

export const useDocsBreadcrumb = () => {
  const userDocsData = useRouteLoaderData<DocsLoaderData>(
    "features/site/routes/_site.docs"
  )
  const developerDocsData = useRouteLoaderData<DocsLoaderData>(
    "features/site/routes/_site.developer"
  )

  return userDocsData?.breadcrumb ?? developerDocsData?.breadcrumb
}
