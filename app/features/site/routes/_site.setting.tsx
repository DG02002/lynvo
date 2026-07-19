import { redirect } from "react-router"
import { sitePaths } from "~/lib/paths"

export function loader() {
  return redirect(sitePaths.settings)
}

export default function SettingsRedirect() {
  return null
}
