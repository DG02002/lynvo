import { render, screen } from "@testing-library/react"

import HelpCenter from "~/features/site/routes/_site.help-center"

describe("help center copy", () => {
  it("explains the visibility and privacy of each support channel", () => {
    render(<HelpCenter />)

    expect(
      screen.getByText(/Only the support team can view/)
    ).toBeInTheDocument()
    expect(screen.getByText(/Anyone can find and read/)).toBeInTheDocument()
    expect(
      screen.getByText(/don’t include personal or account information/)
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /Message on Telegram/ })
    ).toHaveAttribute("href", "https://t.me/lynvo_support")
    expect(
      screen.getByRole("link", { name: /Open a GitHub issue/ })
    ).toHaveAttribute("href", "https://github.com/DG02002/lynvo/issues")
  })
})
