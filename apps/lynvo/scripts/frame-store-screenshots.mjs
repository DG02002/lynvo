import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { frameScreenshot, validatePalette } from "./frame-screenshot.mjs"

const APP_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
)
const SOURCES_DIRECTORY = path.join(
  APP_DIRECTORY,
  "scripts",
  "store-screenshot-sources"
)
const OUTPUT_DIRECTORY = path.join(APP_DIRECTORY, "public", "images", "docs")
// The committed captures were taken in an iPhone 16-sized viewport at 3x;
// the framing layout derives its proportions from this viewport.
const STORE_VIEWPORT = { height: 393, width: 852, deviceScaleFactor: 3 }

const STORE_SHOTS = [
  { name: "tv-bro", theme: "aurora-002" },
  { name: "just-player", theme: "aurora-060" },
  { name: "vlc", theme: "aurora-063" },
  { name: "google-tv", theme: "aurora-061" },
]

const main = async () => {
  const palettes = JSON.parse(
    await readFile(
      path.join(
        APP_DIRECTORY,
        "app",
        "features",
        "site",
        "home",
        "screenshot-palettes.json"
      ),
      "utf8"
    )
  )
  await Promise.all(
    STORE_SHOTS.map(async (shot) => {
      const palette = palettes[shot.theme]
      if (!palette) {
        throw new Error(
          `${shot.name} references an unknown palette: ${shot.theme}.`
        )
      }
      validatePalette(palette, shot.theme)
      const capture = await readFile(
        path.join(SOURCES_DIRECTORY, `${shot.name}.png`)
      )
      await frameScreenshot(capture, palette, {
        viewport: STORE_VIEWPORT,
        outputPath: path.join(OUTPUT_DIRECTORY, `play-store-${shot.name}.webp`),
      })
      process.stdout.write(
        `Framed ${shot.name} → public/images/docs/play-store-${shot.name}.webp\n`
      )
    })
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
