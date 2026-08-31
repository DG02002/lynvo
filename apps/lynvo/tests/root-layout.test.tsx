import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"
import { DocumentLayout } from "~/root/layout"

const EmptyComponent = () => null

it("does not apply the script nonce to stylesheet links", () => {
  const linksMock = vi.fn()
  const LinksComponent = (props: { nonce: string }) => {
    linksMock(props)
    return null
  }
  renderToStaticMarkup(
    <DocumentLayout
      initialTheme="dark"
      LinksComponent={LinksComponent}
      MetaComponent={EmptyComponent}
      ScriptsComponent={EmptyComponent}
      ScrollRestorationComponent={EmptyComponent}
      RouteSeoMetadataComponent={EmptyComponent}
    >
      Content
    </DocumentLayout>
  )

  expect(linksMock).toHaveBeenCalledWith({ nonce: "" })
})
