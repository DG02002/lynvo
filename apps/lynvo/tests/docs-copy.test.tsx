import { render, screen } from "@testing-library/react"

import {
  AndroidTvPlayerDefaults,
  CodeBlock,
} from "~/features/site/docs/docs-components"

describe("documentation copy", () => {
  it("describes server-dependent player selection without Lynvo resume state", () => {
    render(<AndroidTvPlayerDefaults />)

    expect(
      screen.getByText(/marks an item opened the first time you open it/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /recommended for links whose servers support HTTP byte-range requests/i
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /recommended for links without HTTP byte-range support/i
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(/MPV and MX Player are also available/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/does not store a playback position or resume state/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/cannot seek without byte-range support/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/may still allow seeking for some links/i)
    ).toBeInTheDocument()
  })

  it("names the code block in its copy action", () => {
    render(
      <CodeBlock label="Terminal">
        <pre>
          <code>pnpm test</code>
        </pre>
      </CodeBlock>
    )

    expect(
      screen.getByRole("button", { name: "Copy code from Terminal" })
    ).toBeInTheDocument()
  })
})
