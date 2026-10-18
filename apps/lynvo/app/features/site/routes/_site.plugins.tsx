import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  type LoaderFunctionArgs,
  useLoaderData,
  useRevalidator,
} from "react-router"

import { LoadErrorRetry } from "~/components/load-error-retry"
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

import type { Route } from "./+types/_site.plugins"

export const meta = (_: Route.MetaArgs) => [
  { title: "Plugins | Lynvo" },
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
  const revalidator = useRevalidator()

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12 md:px-8 md:py-24">
      <header className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
        <h1 className="my-4 text-4xl font-normal text-balance md:text-6xl">
          Lynvo Plugins
        </h1>
      </header>

      <section
        aria-label="Lynvo Plugins"
        className="mx-auto mt-10 max-w-4xl md:mt-14"
      >
        <Table variant="plain">
          <TableHeader className="hidden md:table-header-group">
            <TableRow>
              <TableHead>Plugin</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lynvoPlugins === null ? (
              <TableRow>
                <TableCell colSpan={2}>
                  <div className="py-8 text-muted-foreground">
                    <LoadErrorRetry
                      message="Lynvo Plugin information is currently unavailable."
                      isRetrying={revalidator.state === "loading"}
                      onRetry={() => revalidator.revalidate()}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              lynvoPlugins.map((plugin) => (
                <TableRow key={plugin.id} className="block md:table-row">
                  <TableCell className="block md:table-cell">
                    <a
                      href={plugin.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center gap-3 mt-6 font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 md:my-5"
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
                  <TableCell className="block max-w-none md:table-cell md:max-w-md">
                    <p className="mt-2 mb-6 pl-12 text-muted-foreground text-pretty md:px-3 md:py-5">
                      {plugin.description}
                    </p>
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
