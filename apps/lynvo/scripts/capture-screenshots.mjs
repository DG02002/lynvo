import { spawnSync } from "node:child_process"
import { mkdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { Schema } from "effect"
import { chromium } from "playwright"

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
  context: Schema.Literals(["desktop", "tv", "phone"]),
  framingTheme: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  output: Schema.NonEmptyString,
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
  if (shot.context === "tv" && shot.userAgent !== TV_BRO_USER_AGENT) {
    throw new Error(`${shot.name} must use the verified TV Bro user agent.`)
  }
  if (shot.context === "phone" && shot.userAgent !== PIXEL_10_USER_AGENT) {
    throw new Error(`${shot.name} must use the Pixel 10 Chrome user agent.`)
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
  if (state.names.has(shot.name)) {
    throw new Error(`The screenshot name is duplicated: ${shot.name}`)
  }
  if (state.themes.has(shot.framingTheme)) {
    throw new Error(`The framing theme is duplicated: ${shot.framingTheme}`)
  }
  state.names.add(shot.name)
  state.themes.add(shot.framingTheme)
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

  const state = {
    names: new Set(),
    outputs: new Set(),
    themes: new Set(),
  }
  const shots = manifest.shots.map((shot) =>
    expandShotSetup(shot, manifest.setups)
  )
  for (const shot of shots) {
    validateShot(shot, state)
  }
  return shots
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
    await page.evaluate(() => document.fonts.ready.then(() => true))
    await resetScrollForCapture(page, shot)
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
      `${shot.name}\tseed=${shot.seedScenario}\troute=${shot.route}\t${shot.output}${blocked}\n`
    )
  }
}

const captureShots = async (shots, origin) => {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const shot of shots) {
      // SAFETY: Browser contexts are isolated and captures are written in manifest order.
      // oxlint-disable-next-line eslint/no-await-in-loop
      await captureShot(browser, shot, origin)
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
  const allShots = await readManifest()
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
  await captureShots(runnableShots, origin)
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
