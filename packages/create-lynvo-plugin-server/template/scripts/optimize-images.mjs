#!/usr/bin/env node
import { createHash } from "node:crypto"
import { createRequire } from "node:module"
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import path from "node:path"
import process from "node:process"

const requireFromProject = createRequire(
  path.join(process.cwd(), "package.json")
)
const sharp = requireFromProject("sharp")

const CONFIG = {
  maxWidth: 256,
  maxHeight: 256,
  webp: {
    quality: 88,
    alphaQuality: 100,
    effort: 6,
  },
}

const targetArg = process.argv[2] ?? "public/icons/sources"
const targetDir = path.resolve(process.cwd(), targetArg)
const cacheDir = path.resolve(process.cwd(), ".cache/image-optimizer")
const cacheFile = path.join(cacheDir, "images.json")

const hashBuffer = (buffer) => createHash("sha256").update(buffer).digest("hex")
const cacheKeyFor = (filePath) => path.relative(process.cwd(), filePath)
const configHash = hashBuffer(Buffer.from(JSON.stringify(CONFIG)))

const readCache = async () => {
  try {
    return JSON.parse(await readFile(cacheFile, "utf8"))
  } catch {
    return {}
  }
}

const writeCache = async (cache) => {
  await mkdir(cacheDir, { recursive: true })
  await writeFile(cacheFile, `${JSON.stringify(cache, null, 2)}\n`)
}

const listSourceFiles = async (directory) => {
  try {
    const entries = await readdir(directory, { withFileTypes: true })
    return entries
      .filter(
        (entry) =>
          entry.isFile() &&
          [".png", ".webp"].includes(path.extname(entry.name).toLowerCase())
      )
      .map((entry) => path.join(directory, entry.name))
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return []
    }
    throw error
  }
}

const optimizeWebp = async (filePath, cache) => {
  const input = await readFile(filePath)
  const inputHash = hashBuffer(input)
  const outputPath = filePath.replace(/\.(png|webp)$/i, ".webp")
  const key = cacheKeyFor(outputPath)
  const cached = cache[key]

  if (cached?.outputHash === inputHash && cached?.configHash === configHash) {
    return { status: "cached", key, bytes: input.length }
  }

  const image = sharp(input, { failOn: "none" })
  const metadata = await image.metadata()
  const shouldResize =
    (metadata.width ?? 0) > CONFIG.maxWidth ||
    (metadata.height ?? 0) > CONFIG.maxHeight
  const isWebp = path.extname(filePath).toLowerCase() === ".webp"

  // Lossy WebP encoding is not idempotent and can vary between native codec
  // builds. Once a WebP satisfies the size contract, treat it as a final
  // artifact instead of recompressing it on every clean machine or CI run.
  if (isWebp && !shouldResize) {
    cache[key] = {
      configHash,
      outputHash: inputHash,
      bytes: input.length,
      width: metadata.width,
      height: metadata.height,
      optimizedAt: new Date().toISOString(),
    }
    return {
      status: "already-optimal",
      key,
      before: input.length,
      after: input.length,
    }
  }

  const optimized = await image
    .resize({
      width: CONFIG.maxWidth,
      height: CONFIG.maxHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp(CONFIG.webp)
    .toBuffer()

  const output = optimized
  const outputHash = hashBuffer(output)

  const temporaryPath = `${outputPath}.tmp`
  await writeFile(temporaryPath, output)
  await rename(temporaryPath, outputPath)
  if (filePath !== outputPath) {
    await rm(filePath)
  }

  const currentStat = await stat(outputPath)
  cache[key] = {
    configHash,
    outputHash,
    bytes: currentStat.size,
    width: metadata.width,
    height: metadata.height,
    optimizedAt: new Date().toISOString(),
  }

  return {
    status: "optimized",
    key,
    before: input.length,
    after: currentStat.size,
  }
}

const main = async () => {
  const files = await listSourceFiles(targetDir)
  if (files.length === 0) {
    console.log(`No PNG or WebP icons found in ${targetArg}`)
    return
  }

  const cache = await readCache()
  const results = []

  for (const file of files) {
    try {
      results.push(await optimizeWebp(file, cache))
    } catch (error) {
      await rm(`${file}.tmp`, { force: true })
      throw error
    }
  }

  await writeCache(cache)

  for (const result of results) {
    if (result.status === "cached") {
      console.log(`cached ${result.key} (${result.bytes} bytes)`)
    } else {
      console.log(
        `${result.status} ${result.key} (${result.before} -> ${result.after} bytes)`
      )
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
