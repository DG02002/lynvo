import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"

const { linksMock } = vi.hoisted(() => ({ linksMock: vi.fn() }))

vi.mock("react-router", () => ({
  Links: (props: unknown) => {
    linksMock(props)
    return null
  },
  Meta: () => null,
  Scripts: () => null,
  ScrollRestoration: () => null,
  useRouteLoaderData: () => ({ initialTheme: "dark" }),
}))

vi.mock("~/root/route-seo-metadata", () => ({
  RouteSeoMetadata: () => null,
}))

import { Layout } from "~/root/layout"

it("does not apply the script nonce to stylesheet links", () => {
  renderToStaticMarkup(<Layout>Content</Layout>)

  expect(linksMock).toHaveBeenCalledWith({ nonce: "" })
})
