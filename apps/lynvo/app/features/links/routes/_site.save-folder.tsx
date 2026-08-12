import SaveList from "~/components/save-list"
import type { Route } from "./+types/_site.save-folder"

export { loader, meta } from "./_site.save"

const SaveFolderRoute = (_: Route.ComponentProps) => <SaveList />

export default SaveFolderRoute
