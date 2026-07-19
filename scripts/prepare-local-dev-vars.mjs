import { readFile, writeFile } from "node:fs/promises"

const workerVariablesPath = ".dev.vars"
const localConvexVariablesPath = ".env.local"
const localWorkerVariablesPath = ".dev.vars.local"
const convexUrlPattern = /^VITE_CONVEX_URL=.*$/m

const [workerVariables, localConvexVariables] = await Promise.all([
  readFile(workerVariablesPath, "utf8"),
  readFile(localConvexVariablesPath, "utf8"),
])

const localConvexUrlEntry = localConvexVariables.match(convexUrlPattern)?.[0]

if (!localConvexUrlEntry) {
  throw new Error(`${localConvexVariablesPath} must define VITE_CONVEX_URL`)
}

if (!convexUrlPattern.test(workerVariables)) {
  throw new Error(`${workerVariablesPath} must define VITE_CONVEX_URL`)
}

const localWorkerVariables = workerVariables.replace(
  convexUrlPattern,
  localConvexUrlEntry
)

await writeFile(localWorkerVariablesPath, localWorkerVariables)
console.log(`Prepared ${localWorkerVariablesPath}`)
