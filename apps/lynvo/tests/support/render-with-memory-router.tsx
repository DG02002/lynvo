import {
  render as testingRender,
  type RenderResult,
} from "@testing-library/react"
import {
  createContext,
  useContext,
  useState,
  type PropsWithChildren,
  type ReactElement,
  type ReactNode,
} from "react"
import { createMemoryRouter, RouterProvider } from "react-router"

const RenderedContentContext = createContext<ReactNode>(null)

const RenderedContent = () => useContext(RenderedContentContext)

export const renderWithMemoryRouter = (
  ui: ReactElement,
  initialEntries: string | string[] = "/save"
): RenderResult => {
  const initialEntryList = Array.isArray(initialEntries)
    ? initialEntries
    : [initialEntries]
  const RouterWrapper = ({ children }: PropsWithChildren) => {
    const [router] = useState(() =>
      createMemoryRouter([{ path: "*", element: <RenderedContent /> }], {
        initialEntries: initialEntryList,
      })
    )
    return (
      <RenderedContentContext.Provider value={children}>
        <RouterProvider router={router} />
      </RenderedContentContext.Provider>
    )
  }
  return testingRender(ui, { wrapper: RouterWrapper })
}
