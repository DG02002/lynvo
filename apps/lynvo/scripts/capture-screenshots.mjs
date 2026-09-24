import { spawnSync } from "node:child_process"
import { mkdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { Schema } from "effect"
import { chromium } from "playwright"

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
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"])
const TV_BRO_USER_AGENT =
  "TV Bro/1.0 Mozilla/5.0 (Linux; Android 11; Android TV)"
const CONTEXT_VIEWPORTS = {
  desktop: { height: 900, width: 1440 },
  phone: { height: 915, width: 412 },
  tv: { height: 1080, width: 1920 },
}
const STEP_TIMEOUT_MS = 15_000

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
    captureText: Schema.optional(Schema.String),
    expectVisible: LocatorDescriptorSchema,
    path: Schema.String,
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
  context: Schema.Literals(["desktop", "tv", "phone"]),
  framingTheme: Schema.String,
  name: Schema.String,
  output: Schema.String,
  route: Schema.String,
  seedScenario: Schema.String,
  steps: Schema.Array(StepSchema),
  userAgent: Schema.String,
  viewport: Schema.Struct({
    deviceScaleFactor: Schema.Number,
    height: Schema.Number,
    width: Schema.Number,
  }),
})
const ManifestSchema = Schema.Struct({
  shots: Schema.Array(ShotSchema),
  version: Schema.Number,
})

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
  if (shot.context === "tv" && shot.userAgent !== TV_BRO_USER_AGENT) {
    throw new Error(`${shot.name} must use the verified TV Bro user agent.`)
  }
}

const validateOutput = (shot, state) => {
  const outputPath = path.resolve(APP_DIRECTORY, shot.output)
  const docsDirectory =
    path.join(APP_DIRECTORY, "app", "features", "site", "docs", "images") +
    path.sep
  const marketingDirectory =
    path.join(APP_DIRECTORY, ".screenshots", "intermediates") + path.sep
  const isDocsOutput = outputPath.startsWith(docsDirectory)
  const isMarketingOutput = outputPath.startsWith(marketingDirectory)
  if (
    state.outputs.has(outputPath) ||
    path.extname(outputPath) !== ".png" ||
    (!isDocsOutput && !isMarketingOutput) ||
    (isDocsOutput && path.basename(outputPath) !== `${shot.name}.png`)
  ) {
    throw new Error(
      `${shot.name} output must be unique and use its name in the docs images or ignored marketing directory.`
    )
  }
  state.outputs.add(outputPath)
}

const validateShot = (shot, state) => {
  if (!shot.name || state.names.has(shot.name)) {
    throw new Error(
      `The screenshot name is missing or duplicated: ${shot.name}`
    )
  }
  if (!shot.framingTheme || state.themes.has(shot.framingTheme)) {
    throw new Error(
      `The framing theme is missing or duplicated: ${shot.framingTheme}`
    )
  }
  state.names.add(shot.name)
  state.themes.add(shot.framingTheme)
  if (
    !shot.route.startsWith("/") ||
    !shot.output ||
    !shot.userAgent ||
    !["docs", "none"].includes(shot.seedScenario)
  ) {
    throw new Error(`${shot.name} is missing required manifest fields.`)
  }
  validateViewport(shot)
  validateOutput(shot, state)
}

const readManifest = async () => {
  const serialized = await readFile(MANIFEST_PATH, "utf8")
  const manifest = Schema.decodeUnknownSync(ManifestSchema)(
    JSON.parse(serialized)
  )
  if (manifest.shots.length === 0) {
    throw new Error("The screenshot manifest must contain at least one shot.")
  }

  const state = {
    names: new Set(),
    outputs: new Set(),
    themes: new Set(),
  }
  for (const shot of manifest.shots) {
    validateShot(shot, state)
  }
  return manifest.shots
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

const resolveLocalOrigin = (value) => {
  const origin = new URL(value)
  if (
    origin.protocol !== "http:" ||
    !LOCAL_HOSTNAMES.has(origin.hostname) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error(
      "Screenshot capture only connects to a local HTTP dev server. Set LYNVO_SEED_ORIGIN to a localhost origin."
    )
  }
  return origin
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
    }
  )
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`Seeding the ${scenario} scenario failed.`)
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
    await page.goto(target.href, { waitUntil: "domcontentloaded" })
  } else if (step.action === "click") {
    await getLocator(page, step.target).click()
  } else if (step.action === "fill") {
    await getLocator(page, step.target).fill(step.value)
  }
  await expectVisible(page, step.expectVisible, shot.name)
  if (step.captureText) {
    variables[step.captureText] = (
      await getLocator(page, step.expectVisible).innerText()
    ).trim()
  }
}

const captureShot = async (browser, shot, origin) => {
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

  try {
    const page = await context.newPage()
    page.setDefaultTimeout(STEP_TIMEOUT_MS)
    page.setDefaultNavigationTimeout(STEP_TIMEOUT_MS)
    const pageErrors = []
    page.on("pageerror", (error) => pageErrors.push(error))
    const variables = Object.create(null)

    for (const step of shot.steps) {
      // SAFETY: A later screenshot state depends on each prior visible condition.
      // oxlint-disable-next-line eslint/no-await-in-loop
      await runStep({ page, step, shot, origin, variables })
    }

    await page.addStyleTag({
      content:
        "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;scroll-behavior:auto!important}",
    })
    await page.evaluate(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" })
    })
    await page.evaluate(() => document.fonts.ready.then(() => true))
    if (pageErrors.length > 0) {
      throw new AggregateError(
        pageErrors,
        `${shot.name} raised a browser error.`
      )
    }

    const outputPath = path.resolve(APP_DIRECTORY, shot.output)
    await mkdir(path.dirname(outputPath), { recursive: true })
    await page.screenshot({
      path: outputPath,
      type: "png",
      animations: "disabled",
      caret: "hide",
      fullPage: false,
    })
    process.stdout.write(`Captured ${shot.name} → ${shot.output}\n`)
  } finally {
    await context.close()
  }
}

const main = async () => {
  const options = parseArguments(process.argv.slice(2))
  const allShots = await readManifest()
  const selectedShots = selectShots(allShots, options.only)

  if (options.list) {
    for (const shot of selectedShots) {
      process.stdout.write(`${shot.name}\t${shot.context}\t${shot.route}\n`)
    }
    return
  }

  if (options.dryRun) {
    for (const shot of selectedShots) {
      process.stdout.write(
        `${shot.name}\tseed=${shot.seedScenario}\troute=${shot.route}\t${shot.output}\n`
      )
    }
    return
  }

  const origin = resolveLocalOrigin(
    process.env.LYNVO_SEED_ORIGIN || DEFAULT_ORIGIN
  )
  const scenarios = [...new Set(selectedShots.map((shot) => shot.seedScenario))]
  for (const scenario of scenarios) {
    runSeedScenario(scenario, origin)
  }

  const browser = await chromium.launch({ headless: true })
  try {
    for (const shot of selectedShots) {
      // SAFETY: Browser contexts are isolated and captures are written in manifest order.
      // oxlint-disable-next-line eslint/no-await-in-loop
      await captureShot(browser, shot, origin)
    }
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
