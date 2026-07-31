import { HttpApi } from "effect/unstable/httpapi"
import { LinksGroup } from "./groups/LinksGroup"
import { PluginServersGroup } from "./groups/plugin-servers-group"
import { PluginDomainsGroup } from "./groups/PluginDomainsGroup"
import { ExtractionGroup } from "./groups/extraction-group"
import { TvGroup } from "./groups/TvGroup"
import { RemoteGroup } from "./groups/RemoteGroup"

export class Api extends HttpApi.make("lynvo-api")
  .add(LinksGroup)
  .add(PluginServersGroup)
  .add(PluginDomainsGroup)
  .add(ExtractionGroup)
  .add(TvGroup)
  .add(RemoteGroup) {}
