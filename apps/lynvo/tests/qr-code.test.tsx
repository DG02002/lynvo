import { createHash } from "node:crypto"
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { QrCode } from "~/components/auth/qr-code"
import { encodeQrCode } from "~/lib/qr-code"

const activationUrl = "https://lynvo.example/auth/device?user_code=ABCD-EFGH"

const matrixSignature = (value: string) => {
  const matrix = encodeQrCode(value)
    .map((row) => row.map((module) => (module ? "1" : "0")).join(""))
    .join("\n")

  return createHash("sha256").update(matrix).digest("hex")
}

describe("QR code", () => {
  it("matches the QR Model 2 medium-error-correction vector", () => {
    const modules = encodeQrCode(activationUrl)

    expect(modules).toHaveLength(33)
    expect(modules.every((row) => row.length === 33)).toBe(true)
    expect(matrixSignature(activationUrl)).toBe(
      "0a624693ba41156ed07098f87ce2cef29be97ad65d02dcec7b3d6feaa77ee254"
    )
  })

  it("renders a crisp SVG with a quiet zone", () => {
    const { container } = render(
      <QrCode value={activationUrl} size={180} marginSize={2} />
    )
    const svg = container.querySelector("svg")

    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute("viewBox", "0 0 37 37")
    expect(svg).toHaveAttribute("aria-label", "QR code")
    expect(svg?.querySelectorAll("path")).toHaveLength(2)
  })

  it("supports Unicode values", () => {
    expect(() => encodeQrCode("Lynvo 🚀")).not.toThrow()
  })

  it("rejects data larger than the QR capacity", () => {
    expect(() => encodeQrCode("a".repeat(3000))).toThrow(
      "QR code data is too long"
    )
  })
})
