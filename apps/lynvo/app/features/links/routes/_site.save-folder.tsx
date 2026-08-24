import { useLoaderData } from "react-router"
import SaveList from "~/components/save-list"
import { saveRouteLoader } from "./save-route-loader.server"
import { saveRouteMeta, toInitialSaveItems } from "./save-route-shared"
import type { Route } from "./+types/_site.save-folder"

export const loader = saveRouteLoader
export const meta = saveRouteMeta

const SaveFolderRoute = (_: Route.ComponentProps) => {
  const loaderData = useLoaderData<typeof loader>()
  return (
    <SaveList
      initialItems={toInitialSaveItems(loaderData.savedLinks)}
      initialDataVersion={loaderData.dataVersion}
      initialTitleProjection={loaderData.titleProjection}
    />
  )
}

export default SaveFolderRoute
