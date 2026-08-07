import { render, screen } from "@testing-library/react"

import { CodeBlock } from "~/features/site/docs/docs-components"

describe("documentation copy", () => {
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
