import { render } from "@testing-library/react"
import jsQR from "jsqr"
import { describe, expect, it } from "vitest"
import { QrCode } from "~/components/auth/qr-code"
import { encodeQrCode } from "~/lib/qr-code"

const activationUrl = "https://lynvo.example/auth/device?user_code=ABCD-EFGH"

const rasterizeModules = (
  modules: readonly (readonly boolean[])[],
  margin: number,
  scale: number
) => {
  const moduleCount = modules.length + margin * 2
  const size = moduleCount * scale
  const data = new Uint8ClampedArray(size * size * 4)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const moduleX = Math.floor(x / scale) - margin
      const moduleY = Math.floor(y / scale) - margin
      const dark =
        moduleX >= 0 &&
        moduleY >= 0 &&
        moduleY < modules.length &&
        moduleX < modules[moduleY].length &&
        modules[moduleY][moduleX]
      const offset = (y * size + x) * 4
      const color = dark ? 0 : 255

      data[offset] = color
      data[offset + 1] = color
      data[offset + 2] = color
      data[offset + 3] = 255
    }
  }

  return { data, size }
}

const decodeModules = (modules: readonly (readonly boolean[])[]) => {
  const { data, size } = rasterizeModules(modules, 4, 4)
  return jsQR(data, size, size)?.data
}

describe("QR code", () => {
  it("encodes an activation URL that an independent decoder can read", () => {
    const modules = encodeQrCode(activationUrl)

    expect(modules).toHaveLength(33)
    expect(modules.every((row) => row.length === 33)).toBe(true)
    expect(decodeModules(modules)).toBe(activationUrl)
  })

  it("decodes a larger medium-error-correction value", () => {
    const value = "a".repeat(107)
    const modules = encodeQrCode(value)

    expect(modules).toHaveLength(45)
    expect(decodeModules(modules)).toBe(value)
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
