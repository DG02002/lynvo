import { useLoaderData } from "react-router"
import {
  SaveTitleRouteErrorBoundary,
  SaveTitleRouteFallback,
  SaveTitleRouteView,
} from "~/features/links/components/save-title-route"
import { createSaveTitleRouteLoader } from "./save-title-route-loader.server"
import type { Route } from "./+types/_site.save-show"

export const loader = createSaveTitleRouteLoader({
  expectedMediaKind: "tv-season",
})
export const meta = (_: Route.MetaArgs) => [{ title: "Saved show | Lynvo" }]
export const HydrateFallback = SaveTitleRouteFallback
export const ErrorBoundary = SaveTitleRouteErrorBoundary

const SaveShowRoute = () => {
  const { group } = useLoaderData<typeof loader>()
  return <SaveTitleRouteView group={group} />
}

export default SaveShowRoute
