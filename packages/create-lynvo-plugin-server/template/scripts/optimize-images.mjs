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

const createImageCacheEntry = ({ outputHash, bytes, metadata }) => ({
  configHash,
  outputHash,
  bytes,
  width: metadata.width,
  height: metadata.height,
  optimizedAt: new Date().toISOString(),
})

const writeOptimizedImage = async (image, outputPath, filePath) => {
  const output = await image
    .resize({
      width: CONFIG.maxWidth,
      height: CONFIG.maxHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp(CONFIG.webp)
    .toBuffer()
  const outputHash = hashBuffer(output)
  const temporaryPath = `${outputPath}.tmp`
  await writeFile(temporaryPath, output)
  await rename(temporaryPath, outputPath)
  if (filePath !== outputPath) {
    await rm(filePath)
  }
  const outputStat = await stat(outputPath)
  return { outputHash, bytes: outputStat.size }
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
  const isAlreadyOptimal =
    path.extname(filePath).toLowerCase() === ".webp" && !shouldResize
  if (isAlreadyOptimal) {
    cache[key] = createImageCacheEntry({
      outputHash: inputHash,
      bytes: input.length,
      metadata,
    })
    return {
      status: "already-optimal",
      key,
      before: input.length,
      after: input.length,
    }
  }
  const { outputHash, bytes } = await writeOptimizedImage(
    image,
    outputPath,
    filePath
  )
  cache[key] = createImageCacheEntry({ outputHash, bytes, metadata })
  return {
    status: "optimized",
    key,
    before: input.length,
    after: bytes,
  }
}

const optimizeFilesSequentially = async (files, cache) => {
  const results = []
  const processNextFile = async (fileIndex) => {
    const filePath = files[fileIndex]
    if (!filePath) {
      return
    }
    try {
      results.push(await optimizeWebp(filePath, cache))
    } catch (error) {
      await rm(`${filePath}.tmp`, { force: true })
      throw error
    }
    await processNextFile(fileIndex + 1)
  }
  await processNextFile(0)
  return results
}

const main = async () => {
  const files = await listSourceFiles(targetDir)
  if (files.length === 0) {
    console.log(`No PNG or WebP icons found in ${targetArg}`)
    return
  }

  const cache = await readCache()
  const results = await optimizeFilesSequentially(files, cache)

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
