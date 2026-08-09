import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { type LoaderFunctionArgs, useLoaderData } from "react-router"

import type { Route } from "./+types/_site.plugins"
import { PluginIcon } from "~/components/plugin-icon"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { loadLynvoPlugins } from "~/features/site/settings/lynvo-plugin-catalog.server"
import { getServerEnv } from "~/lib/env.server"

export const meta = (_: Route.MetaArgs) => [
  { title: "Lynvo Plugins | Lynvo" },
  {
    name: "description",
    content: "Explore Lynvo-managed Plugins for supported Sources.",
  },
]

export const loader = async (args: LoaderFunctionArgs) => {
  const environment = getServerEnv(args.context)
  return {
    lynvoPlugins: await loadLynvoPlugins(environment, args.request.url),
  }
}

const Plugins = () => {
  const { lynvoPlugins } = useLoaderData<typeof loader>()

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12 md:px-8 md:py-24">
      <header className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
        <h1 className="my-4 text-4xl font-normal tracking-tight text-balance md:text-6xl">
          Lynvo plugins
        </h1>
      </header>

      <section
        aria-label="Lynvo plugins"
        className="mx-auto mt-10 max-w-4xl md:mt-14"
      >
        <Table>
          <TableHeader className="hidden md:table-header-group">
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-0">Plugin</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lynvoPlugins === null ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={2}
                  className="px-0 py-8 whitespace-normal text-muted-foreground"
                >
                  Lynvo plugin information is currently unavailable.
                </TableCell>
              </TableRow>
            ) : (
              lynvoPlugins.map((plugin) => (
                <TableRow
                  key={plugin.id}
                  className="block hover:bg-transparent md:table-row"
                >
                  <TableCell className="block px-0 pt-6 pb-0 whitespace-normal md:table-cell md:py-5">
                    <a
                      href={plugin.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center gap-3 font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
                    >
                      <PluginIcon icon={plugin.icon} className="size-9" />
                      <span>{plugin.name}</span>
                      <HugeiconsIcon
                        icon={ArrowUpRight01Icon}
                        strokeWidth={2}
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </a>
                  </TableCell>
                  <TableCell className="block max-w-none px-0 pt-2 pb-6 pl-12 whitespace-normal text-muted-foreground text-pretty md:table-cell md:max-w-md md:px-3 md:py-5">
                    {plugin.description}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}

export default Plugins
