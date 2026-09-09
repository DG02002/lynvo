import { useLoaderData } from "react-router"
import SaveList from "~/components/save-list"
import { saveRouteLoader } from "./save-route-loader.server"
import {
  saveRouteMeta,
  shouldRevalidateSaveRoute,
  toInitialSaveItems,
} from "./save-route-shared"

export const loader = saveRouteLoader
export const meta = saveRouteMeta
export const shouldRevalidate = shouldRevalidateSaveRoute

const SaveRoute = () => {
  const loaderData = useLoaderData<typeof loader>()
  return (
    <SaveList
      initialItems={toInitialSaveItems(loaderData.savedLinks)}
      initialDataVersion={loaderData.dataVersion}
    />
  )
}

export default SaveRoute
