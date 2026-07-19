#!/usr/bin/env node
import { createHash } from "node:crypto"
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
import sharp from "sharp"

const config = {
  maxWidth: 256,
  maxHeight: 256,
  webp: { quality: 88, alphaQuality: 100, effort: 6 },
}

const targetDir = path.resolve(
  process.cwd(),
  process.argv[2] ?? "public/icons/plugins"
)
const cacheFile = path.resolve(
  process.cwd(),
  ".cache/image-optimizer/plugin-icons.json"
)
const configHash = createHash("sha256")
  .update(JSON.stringify(config))
  .digest("hex")

const hash = (buffer) => createHash("sha256").update(buffer).digest("hex")

const readCache = async () => {
  try {
    return JSON.parse(await readFile(cacheFile, "utf8"))
  } catch {
    return {}
  }
}

const writeCache = async (cache) => {
  await mkdir(path.dirname(cacheFile), { recursive: true })
  await writeFile(cacheFile, `${JSON.stringify(cache, null, 2)}\n`)
}

const listSources = async () =>
  (await readdir(targetDir, { withFileTypes: true }))
    .filter(
      (entry) =>
        entry.isFile() &&
        [".png", ".webp"].includes(path.extname(entry.name).toLowerCase())
    )
    .map((entry) => path.join(targetDir, entry.name))

const optimize = async (filePath, cache) => {
  const input = await readFile(filePath)
  const inputHash = hash(input)
  const outputPath = filePath.replace(/\.(png|webp)$/i, ".webp")
  const key = path.relative(process.cwd(), outputPath)

  if (
    cache[key]?.outputHash === inputHash &&
    cache[key]?.configHash === configHash
  ) {
    console.log(`cached ${key} (${input.length} bytes)`)
    return
  }

  const image = sharp(input, { failOn: "none" })
  const optimized = await image
    .resize({
      width: config.maxWidth,
      height: config.maxHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp(config.webp)
    .toBuffer()
  const isWebp = path.extname(filePath).toLowerCase() === ".webp"
  const output = !isWebp || optimized.length < input.length ? optimized : input

  if (output !== input) {
    const tmpPath = `${outputPath}.tmp`
    await writeFile(tmpPath, output)
    await rename(tmpPath, outputPath)
    if (filePath !== outputPath) {
      await rm(filePath)
    }
  }

  const current = await stat(outputPath)
  cache[key] = {
    configHash,
    outputHash: hash(await readFile(outputPath)),
    bytes: current.size,
    optimizedAt: new Date().toISOString(),
  }
  console.log(`${output !== input ? "optimized" : "already-optimal"} ${key}`)
}

const main = async () => {
  const cache = await readCache()
  for (const filePath of await listSources()) {
    try {
      await optimize(filePath, cache)
    } catch (error) {
      await rm(`${filePath}.tmp`, { force: true })
      throw error
    }
  }
  await writeCache(cache)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
