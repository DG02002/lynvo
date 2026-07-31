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
    content: "Explore the plugins supported and maintained by Lynvo.",
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
    <div className="mx-auto w-full max-w-5xl px-4 py-16 md:px-8 md:py-24">
      <header className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
        <h1 className="my-4 text-4xl font-normal tracking-tight text-balance md:text-6xl">
          Lynvo plugins
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground text-pretty">
          Plugins maintained by Lynvo for supported third-party projects.
        </p>
      </header>

      <section aria-label="Lynvo plugins" className="mx-auto mt-14 max-w-4xl">
        <Table>
          <TableHeader>
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
                <TableRow key={plugin.id} className="hover:bg-transparent">
                  <TableCell className="pl-0 py-5 whitespace-normal">
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
                  <TableCell className="max-w-md py-5 whitespace-normal text-muted-foreground">
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
