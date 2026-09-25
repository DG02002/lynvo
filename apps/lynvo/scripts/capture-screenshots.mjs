import { spawnSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { Schema } from "effect"
import { chromium } from "playwright"

import screenshotFrameSpec from "../app/features/site/home/screenshot-frame-spec.json" with { type: "json" }
import {
  frameScreenshot,
  saveScreenshot,
  validatePalette,
} from "./frame-screenshot.mjs"
import { assertLocalHttpOrigin } from "./local-origin.mjs"

const APP_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
)
const WORKSPACE_DIRECTORY = path.resolve(APP_DIRECTORY, "../..")
const MANIFEST_PATH = path.join(
  APP_DIRECTORY,
  "scripts",
  "screenshot-manifest.json"
)
const DEFAULT_ORIGIN = "http://localhost:5173"
const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
const TV_BRO_USER_AGENT =
  "TV Bro/1.0 Mozilla/5.0 (Linux; Android 11; Android TV)"
const PIXEL_10_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.8010.12 Mobile Safari/537.36"
const CONTEXT_VIEWPORTS = {
  desktop: { height: 836, width: 1470 },
  phone: { height: 924, width: 412 },
  tv: { height: 1080, width: 1920 },
}
const STEP_TIMEOUT_MS = 15_000
const IMAGE_TIMEOUT_MS = 45_000
const SEED_TIMEOUT_MS = 120_000

const LocatorDescriptorSchema = Schema.Struct({
  exact: Schema.optional(Schema.Boolean),
  index: Schema.optional(Schema.Number),
  label: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  placeholder: Schema.optional(Schema.String),
  role: Schema.optional(Schema.String),
  selector: Schema.optional(Schema.String),
  text: Schema.optional(Schema.String),
})
const StepSchema = Schema.Union([
  Schema.Struct({
    action: Schema.Literal("navigate"),
    captureAs: Schema.optional(Schema.NonEmptyString),
    expectVisible: LocatorDescriptorSchema,
    path: Schema.NonEmptyString,
  }),
  Schema.Struct({
    action: Schema.Literal("click"),
    expectVisible: LocatorDescriptorSchema,
    target: LocatorDescriptorSchema,
  }),
  Schema.Struct({
    action: Schema.Literal("fill"),
    expectVisible: LocatorDescriptorSchema,
    target: LocatorDescriptorSchema,
    value: Schema.String,
  }),
])
const ShotSchema = Schema.Struct({
  blockedReason: Schema.optional(Schema.NonEmptyString),
  captureTarget: Schema.optional(LocatorDescriptorSchema),
  captureStyles: Schema.optional(Schema.NonEmptyString),
  context: Schema.Literals(["desktop", "tv", "phone"]),
  framing: Schema.Union([
    Schema.Literal(false),
    Schema.Struct({
      mode: Schema.Literals(["css", "postprocess"]),
      theme: Schema.NonEmptyString,
    }),
  ]),
  holdExtractionUntilCapture: Schema.optional(Schema.Boolean),
  name: Schema.NonEmptyString,
  output: Schema.NonEmptyString,
  preserveScrollPosition: Schema.optional(Schema.Boolean),
  requiredTmdbImageCount: Schema.optional(Schema.Number),
  requiredImages: Schema.optional(Schema.Array(Schema.NonEmptyString)),
  route: Schema.NonEmptyString,
  seedScenario: Schema.Literals(["docs", "none"]),
  setup: Schema.optional(Schema.Array(Schema.NonEmptyString)),
  steps: Schema.Array(StepSchema),
  userAgent: Schema.NonEmptyString,
  viewport: Schema.Struct({
    deviceScaleFactor: Schema.Number,
    height: Schema.Number,
    width: Schema.Number,
  }),
})
const ManifestSchema = Schema.Struct({
  setups: Schema.Record(Schema.String, Schema.Array(StepSchema)),
  shots: Schema.Array(ShotSchema),
  version: Schema.Number,
})
const ScreenshotPaletteSchema = Schema.Struct({
  baseEnd: Schema.NonEmptyString,
  baseMiddle: Schema.NonEmptyString,
  baseStart: Schema.NonEmptyString,
  lowerLeft: Schema.NonEmptyString,
  upperRight: Schema.NonEmptyString,
})
const ScreenshotPalettesSchema = Schema.Record(
  Schema.String,
  ScreenshotPaletteSchema
)
const PALETTE_COLOR_KEYS = [
  "upperRight",
  "lowerLeft",
  "baseStart",
  "baseMiddle",
  "baseEnd",
]
// Keep large background fields from reading as repeats across the five stops.
const MINIMUM_PALETTE_DISTANCE = 3.5

const paletteSignature = (palette) =>
  PALETTE_COLOR_KEYS.map((key) => palette[key]).join("|")

const colorToOklab = (color) => {
  const [red, green, blue] = color
    .slice(1)
    .match(/.{2}/gu)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    )
  const light = Math.cbrt(
    0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue
  )
  const medium = Math.cbrt(
    0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue
  )
  const dark = Math.cbrt(
    0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue
  )
  return [
    0.2104542553 * light + 0.793617785 * medium - 0.0040720468 * dark,
    1.9779984951 * light - 2.428592205 * medium + 0.4505937099 * dark,
    0.0259040371 * light + 0.7827717662 * medium - 0.808675766 * dark,
  ]
}

const paletteDistance = (first, second) =>
  100 *
  Math.sqrt(
    PALETTE_COLOR_KEYS.reduce((distance, key) => {
      const firstLab = colorToOklab(first[key])
      const secondLab = colorToOklab(second[key])
      return (
        distance +
        firstLab.reduce(
          (channelDistance, value, index) =>
            channelDistance + (value - secondLab[index]) ** 2,
          0
        )
      )
    }, 0) / PALETTE_COLOR_KEYS.length
  )

const expandShotSetup = (shot, setups) => {
  if (shot.setup === undefined) {
    return shot
  }
  if (shot.setup.length === 0) {
    throw new Error(`${shot.name} must reference at least one setup.`)
  }
  const setupSteps = shot.setup.flatMap((setupName) => {
    const steps = setups[setupName]
    if (!steps) {
      throw new Error(`${shot.name} references an unknown setup: ${setupName}.`)
    }
    return steps
  })
  return { ...shot, steps: [...setupSteps, ...shot.steps] }
}

const validateViewport = (shot) => {
  const expectedViewport = CONTEXT_VIEWPORTS[shot.context]
  if (
    shot.viewport.deviceScaleFactor !== 2 ||
    shot.viewport.width !== expectedViewport.width ||
    shot.viewport.height !== expectedViewport.height ||
    shot.steps.length === 0
  ) {
    throw new Error(`${shot.name} has an invalid viewport or no steps.`)
  }
  if (
    shot.requiredTmdbImageCount !== undefined &&
    (!Number.isSafeInteger(shot.requiredTmdbImageCount) ||
      shot.requiredTmdbImageCount < 1)
  ) {
    throw new Error(`${shot.name} has an invalid required TMDB image count.`)
  }
  if (shot.context === "tv" && shot.userAgent !== TV_BRO_USER_AGENT) {
    throw new Error(`${shot.name} must use the verified TV Bro user agent.`)
  }
  if (
    shot.context === "phone" &&
    shot.userAgent !== PIXEL_10_USER_AGENT &&
    shot.userAgent !== DESKTOP_USER_AGENT
  ) {
    throw new Error(
      `${shot.name} has an unsupported phone screenshot user agent.`
    )
  }
  if (shot.context === "desktop" && shot.userAgent !== DESKTOP_USER_AGENT) {
    throw new Error(`${shot.name} must use the desktop Chrome user agent.`)
  }
}

const validateOutput = (shot, state) => {
  const outputPath = path.resolve(APP_DIRECTORY, shot.output)
  const docsDirectory =
    path.join(APP_DIRECTORY, "app", "features", "site", "docs", "images") +
    path.sep
  const marketingDirectory =
    path.join(APP_DIRECTORY, ".screenshots", "intermediates") + path.sep
  const homepageImageDirectory =
    path.join(APP_DIRECTORY, "public", "images", "homepage") + path.sep
  const isDocsOutput = outputPath.startsWith(docsDirectory)
  const isMarketingOutput = outputPath.startsWith(marketingDirectory)
  const isHomepageImageOutput = outputPath.startsWith(homepageImageDirectory)
  const extension = path.extname(outputPath)
  if (
    state.outputs.has(outputPath) ||
    ![".png", ".webp"].includes(extension) ||
    (!isDocsOutput && !isMarketingOutput && !isHomepageImageOutput) ||
    (isDocsOutput &&
      path.basename(outputPath) !== `${shot.name}${extension}`) ||
    (isHomepageImageOutput && shot.framing !== false)
  ) {
    throw new Error(
      `${shot.name} output must be unique and use PNG or WebP in the docs images, ignored marketing directory, or raw homepage image directory.`
    )
  }
  state.outputs.add(outputPath)
}

const validateShotFraming = (shot, state, palettes) => {
  if (shot.framing === false) {
    return
  }
  const palette = palettes[shot.framing.theme]
  if (!palette) {
    throw new Error(
      `${shot.name} references an unknown framing palette: ${shot.framing.theme}.`
    )
  }
  if (state.themes.has(shot.framing.theme)) {
    throw new Error(
      `${shot.name} reuses the framing palette ${shot.framing.theme}.`
    )
  }
  const signature = paletteSignature(palette)
  if (state.palettes.has(signature)) {
    throw new Error(
      `${shot.name} reuses a background palette already assigned to another screenshot.`
    )
  }
  state.themes.add(shot.framing.theme)
  state.palettes.add(signature)
  const expectedHomeTheme =
    screenshotFrameSpec.homeThemes[
      shot.context === "phone" ? "phone" : "desktop"
    ]
  if (
    shot.framing.mode === "css" &&
    (shot.captureTarget === undefined ||
      shot.framing.theme !== expectedHomeTheme)
  ) {
    throw new Error(
      `${shot.name} must use its assigned homepage CSS palette and capture target.`
    )
  }
}

const validateShot = (shot, state, palettes) => {
  if (state.names.has(shot.name)) {
    throw new Error(`The screenshot name is duplicated: ${shot.name}`)
  }
  state.names.add(shot.name)
  validateShotFraming(shot, state, palettes)
  if (!shot.route.startsWith("/")) {
    throw new Error(`${shot.name} route must start with "/".`)
  }
  const finalNavigation = shot.steps
    .toReversed()
    .find((step) => step.action === "navigate")
  if (
    !finalNavigation ||
    new URL(finalNavigation.path, "http://localhost").pathname !== shot.route
  ) {
    throw new Error(
      `${shot.name} route must match its final navigate step's pathname.`
    )
  }
  validateViewport(shot)
  validateOutput(shot, state)
}

const readScreenshotPalettes = async () => {
  const palettesPath = path.join(
    APP_DIRECTORY,
    "app",
    "features",
    "site",
    "home",
    "screenshot-palettes.json"
  )
  const serialized = await readFile(palettesPath, "utf8")
  const palettes = Schema.decodeUnknownSync(ScreenshotPalettesSchema)(
    JSON.parse(serialized)
  )
  const signatures = new Set()
  const checkedPalettes = []
  for (const [theme, palette] of Object.entries(palettes)) {
    validatePalette(palette, theme)
    const signature = paletteSignature(palette)
    if (signatures.has(signature)) {
      throw new Error(`${theme} repeats another palette definition.`)
    }
    signatures.add(signature)
    for (const other of checkedPalettes) {
      if (paletteDistance(palette, other.palette) < MINIMUM_PALETTE_DISTANCE) {
        throw new Error(
          `${theme} is too similar to ${other.theme}; screenshot palettes must remain visually distinct.`
        )
      }
    }
    checkedPalettes.push({ theme, palette })
  }
  return palettes
}

const readManifest = async () => {
  const serialized = await readFile(MANIFEST_PATH, "utf8")
  const manifest = Schema.decodeUnknownSync(ManifestSchema)(
    JSON.parse(serialized)
  )
  if (manifest.shots.length === 0) {
    throw new Error("The screenshot manifest must contain at least one shot.")
  }

  const usedSetups = new Set(manifest.shots.flatMap((shot) => shot.setup ?? []))
  const unusedSetups = Object.keys(manifest.setups).filter(
    (setupName) => !usedSetups.has(setupName)
  )
  if (unusedSetups.length > 0) {
    throw new Error(`Unused screenshot setups: ${unusedSetups.join(", ")}.`)
  }

  const palettes = await readScreenshotPalettes()
  const state = {
    names: new Set(),
    outputs: new Set(),
    palettes: new Set(),
    themes: new Set(),
  }
  const shots = manifest.shots.map((shot) =>
    expandShotSetup(shot, manifest.setups)
  )
  for (const shot of shots) {
    validateShot(shot, state, palettes)
  }
  const unusedPalettes = Object.keys(palettes).filter(
    (theme) => !state.themes.has(theme)
  )
  if (unusedPalettes.length > 0) {
    throw new Error(`Unused screenshot palettes: ${unusedPalettes.join(", ")}.`)
  }
  return { palettes, shots }
}

const parseArguments = (argumentsList) => {
  const options = { dryRun: false, list: false, only: undefined }
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]
    if (argument === "--list") {
      options.list = true
    } else if (argument === "--dry-run") {
      options.dryRun = true
    } else if (argument === "--only") {
      const prefix = argumentsList[index + 1]
      if (!prefix || prefix.startsWith("--")) {
        throw new Error("--only needs a screenshot name or prefix.")
      }
      options.only = prefix
      index += 1
    } else {
      throw new Error(
        `Unknown option: ${argument}. Use --only <name-or-prefix>, --list, or --dry-run.`
      )
    }
  }
  return options
}

const selectShots = (shots, prefix) => {
  if (!prefix) {
    return shots
  }
  const selected = shots.filter((shot) => shot.name.startsWith(prefix))
  if (selected.length === 0) {
    throw new Error(`No screenshot name starts with ${JSON.stringify(prefix)}.`)
  }
  return selected
}

const runSeedScenario = (scenario, origin) => {
  if (scenario === "none") {
    return
  }
  const result = spawnSync(
    "pnpm",
    ["--filter", "@lynvo/app", "seed", scenario],
    {
      cwd: WORKSPACE_DIRECTORY,
      env: { ...process.env, LYNVO_SEED_ORIGIN: origin.origin },
      stdio: "inherit",
      timeout: SEED_TIMEOUT_MS,
    }
  )
  if (result.error?.code === "ETIMEDOUT") {
    throw new Error(
      `Seeding the ${scenario} scenario timed out after ${SEED_TIMEOUT_MS} ms.`,
      { cause: result.error }
    )
  }
  if (result.error) {
    throw new Error(
      `Seeding the ${scenario} scenario could not start: ${result.error.message}`,
      { cause: result.error }
    )
  }
  if (result.signal) {
    throw new Error(
      `Seeding the ${scenario} scenario was stopped by ${result.signal}.`
    )
  }
  if (result.status !== 0) {
    throw new Error(
      `Seeding the ${scenario} scenario exited with status ${result.status ?? "unknown"}.`
    )
  }
}

const getLocator = (page, descriptor) => {
  let locator
  if (descriptor.role) {
    locator = page.getByRole(descriptor.role, {
      name: descriptor.name,
      exact: descriptor.exact ?? true,
    })
  } else if (descriptor.label) {
    locator = page.getByLabel(descriptor.label, {
      exact: descriptor.exact ?? true,
    })
  } else if (descriptor.placeholder) {
    locator = page.getByPlaceholder(descriptor.placeholder, {
      exact: descriptor.exact ?? true,
    })
  } else if (descriptor.text) {
    locator = page.getByText(descriptor.text, {
      exact: descriptor.exact ?? true,
    })
  } else if (descriptor.selector) {
    locator = page.locator(descriptor.selector)
  } else {
    throw new Error(
      `Unsupported locator descriptor: ${JSON.stringify(descriptor)}`
    )
  }
  if (descriptor.index !== undefined) {
    return locator.nth(descriptor.index)
  }
  return locator
}

const expectVisible = async (page, descriptor, shotName) => {
  try {
    await getLocator(page, descriptor).waitFor({
      state: "visible",
      timeout: STEP_TIMEOUT_MS,
    })
  } catch (error) {
    throw new Error(
      `${shotName} did not reach its expect-visible condition ${JSON.stringify(descriptor)}.`,
      { cause: error }
    )
  }
}

const waitForHydrationActivityResponse = async (page, origin, shotName) => {
  let response
  try {
    response = await page.waitForResponse(
      (candidate) => {
        const responseUrl = new URL(candidate.url())
        return (
          responseUrl.origin === origin.origin &&
          responseUrl.pathname === "/api/settings/activity" &&
          candidate.request().method() === "POST"
        )
      },
      { timeout: STEP_TIMEOUT_MS }
    )
  } catch (cause) {
    throw new Error(
      `${shotName} did not receive its hydration activity response (POST /api/settings/activity).`,
      { cause }
    )
  }
  if (!response.ok()) {
    throw new Error(
      `${shotName} received HTTP ${response.status()} from its hydration activity response (POST /api/settings/activity).`
    )
  }
}

const runStep = async ({ page, step, shot, origin, variables }) => {
  if (step.action === "navigate") {
    const pathTemplate = step.path.replaceAll(
      /\{\{([\w-]+)\}\}/gu,
      (_, name) => {
        const value = variables[name]
        if (value === undefined) {
          throw new Error(`${shot.name} uses an unset value: ${name}`)
        }
        return encodeURIComponent(value)
      }
    )
    const target = new URL(pathTemplate, origin)
    if (target.origin !== origin.origin) {
      throw new Error(`${shot.name} contains a non-local navigation step.`)
    }
    // The root client effect emits this response after hydration.
    await Promise.all([
      waitForHydrationActivityResponse(page, origin, shot.name),
      page.goto(target.href, { waitUntil: "domcontentloaded" }),
    ])
    await page.evaluate(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" })
    })
  } else if (step.action === "click") {
    await getLocator(page, step.target).click()
  } else if (step.action === "fill") {
    await getLocator(page, step.target).fill(step.value)
  }
  await expectVisible(page, step.expectVisible, shot.name)
  if (step.captureAs) {
    variables[step.captureAs] = (
      await getLocator(page, step.expectVisible).innerText()
    ).trim()
  }
}

const resetScrollForCapture = async (page, shot) => {
  await page.evaluate(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  })
  const finalStep = shot.steps.at(-1)
  await getLocator(page, finalStep.expectVisible).scrollIntoViewIfNeeded()
  await expectVisible(page, finalStep.expectVisible, shot.name)
}

const waitForRequiredImages = async (page, shot) => {
  await Promise.all(
    (shot.requiredImages ?? []).map(async (alt) => {
      try {
        await page.waitForFunction(
          (expectedAlt) => {
            const image = [...document.images].find(
              (candidate) => candidate.alt === expectedAlt
            )
            if (!image) {
              return false
            }
            image.loading = "eager"
            return image.complete && image.naturalWidth > 0
          },
          alt,
          { timeout: IMAGE_TIMEOUT_MS }
        )
        await page.evaluate((expectedAlt) => {
          const image = [...document.images].find(
            (candidate) => candidate.alt === expectedAlt
          )
          if (!image) {
            throw new Error(`The required image ${expectedAlt} is missing.`)
          }
          return image.decode()
        }, alt)
      } catch (error) {
        throw new Error(
          `${shot.name} did not load its required image ${JSON.stringify(alt)}.`,
          { cause: error }
        )
      }
    })
  )

  if (shot.requiredTmdbImageCount === undefined) {
    return
  }

  try {
    await page.waitForFunction(
      (requiredImageCount) => {
        const artworkImages = [...document.images].filter((image) => {
          if (image.dataset.tmdbImagePreview === "true") {
            return false
          }
          return /(^|\/)image\.tmdb\.org\/t\/p\//u.test(
            image.currentSrc || image.src
          )
        })
        for (const image of artworkImages) {
          image.loading = "eager"
        }
        return (
          artworkImages.length >= requiredImageCount &&
          artworkImages.every(
            (image) => image.complete && image.naturalWidth > 0
          )
        )
      },
      shot.requiredTmdbImageCount,
      { timeout: IMAGE_TIMEOUT_MS }
    )
    await page.evaluate(async (requiredImageCount) => {
      const artworkImages = [...document.images].filter(
        (image) =>
          image.dataset.tmdbImagePreview !== "true" &&
          /(^|\/)image\.tmdb\.org\/t\/p\//u.test(image.currentSrc || image.src)
      )
      if (artworkImages.length < requiredImageCount) {
        throw new Error("The required TMDB artwork images are missing.")
      }
      await Promise.all(artworkImages.map((image) => image.decode()))
    }, shot.requiredTmdbImageCount)
  } catch (error) {
    throw new Error(
      `${shot.name} did not load all ${shot.requiredTmdbImageCount} required TMDB artwork images.`,
      { cause: error }
    )
  }
}

const waitForVisibleTmdbImages = async (page, shot) => {
  try {
    await page.waitForFunction(
      () => {
        const visibleImages = [...document.images].filter((image) => {
          if (
            image.dataset.tmdbImagePreview === "true" ||
            !/(^|\/)image\.tmdb\.org\/t\/p\//u.test(
              image.currentSrc || image.src
            )
          ) {
            return false
          }
          const bounds = image.getBoundingClientRect()
          return (
            bounds.width > 0 &&
            bounds.height > 0 &&
            bounds.bottom > 0 &&
            bounds.right > 0 &&
            bounds.top < window.innerHeight &&
            bounds.left < window.innerWidth
          )
        })
        for (const image of visibleImages) {
          image.loading = "eager"
        }
        return visibleImages.every(
          (image) => image.complete && image.naturalWidth > 0
        )
      },
      null,
      { timeout: IMAGE_TIMEOUT_MS }
    )
    await page.evaluate(async () => {
      const visibleImages = [...document.images].filter((image) => {
        if (
          image.dataset.tmdbImagePreview === "true" ||
          !/(^|\/)image\.tmdb\.org\/t\/p\//u.test(image.currentSrc || image.src)
        ) {
          return false
        }
        const bounds = image.getBoundingClientRect()
        return (
          bounds.width > 0 &&
          bounds.height > 0 &&
          bounds.bottom > 0 &&
          bounds.right > 0 &&
          bounds.top < window.innerHeight &&
          bounds.left < window.innerWidth
        )
      })
      await Promise.all(visibleImages.map((image) => image.decode()))
    })
  } catch (error) {
    throw new Error(
      `${shot.name} did not finish loading its visible TMDB artwork.`,
      { cause: error }
    )
  }
}

const runShotSteps = async ({ page, shot, origin, variables }) => {
  for (const step of shot.steps) {
    // SAFETY: A later screenshot state depends on each prior visible condition.
    // oxlint-disable-next-line eslint/no-await-in-loop
    await runStep({ page, step, shot, origin, variables })
  }
}

const preparePageForCapture = async ({ page, shot }) => {
  if (!shot.preserveScrollPosition) {
    await page.addStyleTag({
      content: [
        "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;scroll-behavior:auto!important}",
        shot.captureStyles ?? "",
      ].join("\n"),
    })
  }
  await page.evaluate(() => document.fonts.ready.then(() => true))
  if (shot.preserveScrollPosition) {
    await expectVisible(page, shot.steps.at(-1).expectVisible, shot.name)
  } else {
    await resetScrollForCapture(page, shot)
  }
  await waitForRequiredImages(page, shot)
  await waitForVisibleTmdbImages(page, shot)
  if (shot.framing !== false && shot.framing.mode === "css") {
    await page.waitForFunction(
      () => {
        const image = document.querySelector(".home-screenshot-frame__image")
        return (
          image instanceof HTMLImageElement &&
          image.complete &&
          image.naturalWidth > 0
        )
      },
      null,
      { timeout: STEP_TIMEOUT_MS }
    )
  }
}

const saveCapturedShot = async ({ page, shot, palettes }) => {
  const outputPath = path.resolve(APP_DIRECTORY, shot.output)
  const screenshotOptions = {
    type: "png",
    animations: "disabled",
    caret: "hide",
  }
  const capture = shot.captureTarget
    ? await getLocator(page, shot.captureTarget).screenshot(screenshotOptions)
    : await page.screenshot({ ...screenshotOptions, fullPage: false })
  if (shot.framing !== false && shot.framing.mode === "postprocess") {
    await frameScreenshot(capture, palettes[shot.framing.theme], {
      outputPath,
      viewport: shot.viewport,
    })
  } else {
    await saveScreenshot(capture, outputPath)
  }
  process.stdout.write(`Captured ${shot.name} → ${shot.output}\n`)
}

const createExtractionCaptureGate = () => {
  let release
  let isReleased = false
  const heldUntilCapture = new Promise((resolve) => {
    release = resolve
  })
  const pendingRoutes = new Set()
  const routePattern = "**/api/extract**"
  const holdRoute = async (route) => {
    if (isReleased) {
      await route.continue()
      return
    }
    let resolveRoute
    const routeFinished = new Promise((resolve) => {
      resolveRoute = resolve
    })
    pendingRoutes.add(routeFinished)
    try {
      await heldUntilCapture
      await route.continue()
    } finally {
      pendingRoutes.delete(routeFinished)
      resolveRoute()
    }
  }
  const releaseAndWait = async (page) => {
    isReleased = true
    release()
    await Promise.all(pendingRoutes)
    await page.unroute(routePattern, holdRoute)
  }

  return { holdRoute, releaseAndWait, routePattern }
}

const captureShot = async ({ browser, shot, origin, palettes }) => {
  const context = await browser.newContext({
    viewport: { width: shot.viewport.width, height: shot.viewport.height },
    deviceScaleFactor: shot.viewport.deviceScaleFactor,
    userAgent: shot.userAgent,
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "dark",
    reducedMotion: "reduce",
    isMobile: shot.context === "phone",
    hasTouch: shot.context === "phone",
  })
  let releaseHeldExtraction
  try {
    const page = await context.newPage()
    page.setDefaultTimeout(STEP_TIMEOUT_MS)
    page.setDefaultNavigationTimeout(STEP_TIMEOUT_MS)
    const pageErrors = []
    page.on("pageerror", (error) => pageErrors.push(error))
    if (shot.holdExtractionUntilCapture) {
      const extractionGate = createExtractionCaptureGate()
      await page.route(extractionGate.routePattern, extractionGate.holdRoute)
      releaseHeldExtraction = () => extractionGate.releaseAndWait(page)
    }
    await runShotSteps({ page, shot, origin, variables: Object.create(null) })
    await preparePageForCapture({ page, shot })
    if (pageErrors.length > 0) {
      throw new AggregateError(
        pageErrors,
        `${shot.name} raised a browser error.`
      )
    }
    await saveCapturedShot({ page, shot, palettes })
  } finally {
    await releaseHeldExtraction?.()
    await context.close()
  }
}

const printShotList = (shots) => {
  for (const shot of shots) {
    const blocked = shot.blockedReason ? `\tBLOCKED: ${shot.blockedReason}` : ""
    process.stdout.write(
      `${shot.name}\t${shot.context}\t${shot.route}${blocked}\n`
    )
  }
}

const printShotDryRun = (shots) => {
  for (const shot of shots) {
    const blocked = shot.blockedReason ? `\tBLOCKED: ${shot.blockedReason}` : ""
    process.stdout.write(
      `${shot.name}\tseed=${shot.seedScenario}\troute=${shot.route}\tframing=${shot.framing === false ? "none" : `${shot.framing.mode}:${shot.framing.theme}`}\t${shot.output}${blocked}\n`
    )
  }
}

const captureShots = async (shots, origin, palettes) => {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const shot of shots) {
      // SAFETY: Browser contexts are isolated and captures are written in manifest order.
      // oxlint-disable-next-line eslint/no-await-in-loop
      await captureShot({ browser, shot, origin, palettes })
    }
  } finally {
    await browser.close()
  }
}

const printBlockedShots = (shots) => {
  for (const shot of shots) {
    process.stdout.write(
      `Skipped ${shot.name}: BLOCKED — ${shot.blockedReason}\n`
    )
  }
}

const seedScenariosForShots = (shots, origin) => {
  const scenarios = [...new Set(shots.map((shot) => shot.seedScenario))]
  for (const scenario of scenarios) {
    runSeedScenario(scenario, origin)
  }
}

const main = async () => {
  const options = parseArguments(process.argv.slice(2))
  const { palettes, shots: allShots } = await readManifest()
  const selectedShots = selectShots(allShots, options.only)

  if (options.list) {
    printShotList(selectedShots)
    return
  }

  if (options.dryRun) {
    printShotDryRun(selectedShots)
    return
  }

  const blockedShots = selectedShots.filter((shot) => shot.blockedReason)
  printBlockedShots(blockedShots)
  const runnableShots = selectedShots.filter((shot) => !shot.blockedReason)
  if (runnableShots.length === 0) {
    return
  }

  const origin = assertLocalHttpOrigin(
    process.env.LYNVO_SEED_ORIGIN || DEFAULT_ORIGIN,
    "Screenshot capture only connects to a local HTTP dev server. Set LYNVO_SEED_ORIGIN to a localhost origin."
  )
  seedScenariosForShots(runnableShots, origin)
  await captureShots(runnableShots, origin, palettes)
  if (blockedShots.length > 0) {
    process.stdout.write(
      `Captured ${runnableShots.length} screenshot(s); skipped ${blockedShots.length} blocked screenshot(s).\n`
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
