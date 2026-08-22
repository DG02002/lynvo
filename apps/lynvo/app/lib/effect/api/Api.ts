import { HttpApi } from "effect/unstable/httpapi"
import { PluginServersGroup } from "./groups/plugin-servers-group"
import { PluginDomainsGroup } from "./groups/PluginDomainsGroup"
import { ExtractionGroup } from "./groups/extraction-group"
import { RemoteGroup } from "./groups/RemoteGroup"
import { SettingsGroup } from "./groups/settings-group"

export class Api extends HttpApi.make("lynvo-api")
  .add(PluginServersGroup)
  .add(PluginDomainsGroup)
  .add(ExtractionGroup)
  .add(RemoteGroup)
  .add(SettingsGroup) {}
