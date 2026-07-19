import { HttpApi } from "effect/unstable/httpapi"
import { LinksGroup } from "./groups/LinksGroup"
import { WorkersGroup } from "./groups/WorkersGroup"
import { PluginDomainsGroup } from "./groups/PluginDomainsGroup"
import { ExtractorGroup } from "./groups/ExtractorGroup"
import { TvGroup } from "./groups/TvGroup"
import { RemoteGroup } from "./groups/RemoteGroup"

export class Api extends HttpApi.make("lynvo-api")
  .add(LinksGroup)
  .add(WorkersGroup)
  .add(PluginDomainsGroup)
  .add(ExtractorGroup)
  .add(TvGroup)
  .add(RemoteGroup) {}
