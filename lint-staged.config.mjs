import { existsSync } from "node:fs"
import { relative, sep } from "node:path"

const sourceFilePattern = /\.(?:c|m)?[jt]sx?$/
const ignoredPathPrefixes = ["apps/lynvo/app/components/ui/"]
const ignoredFileNames = new Set(["worker-configuration.d.ts"])

const getRelativePath = (absolutePath) =>
  relative(process.cwd(), absolutePath).split(sep).join("/")

const isLintableSourceFile = (absolutePath) => {
  const relativePath = getRelativePath(absolutePath)
  const fileName = relativePath.slice(relativePath.lastIndexOf("/") + 1)

  return (
    existsSync(absolutePath) &&
    sourceFilePattern.test(relativePath) &&
    !ignoredFileNames.has(fileName) &&
    !ignoredPathPrefixes.some((prefix) => relativePath.startsWith(prefix))
  )
}

const quoteShellArgument = (filePath) =>
  `'${filePath.replaceAll("'", "'\\''")}'`

export default {
  "*": (stagedFilePaths) => {
    const sourceFilePaths = stagedFilePaths.filter(isLintableSourceFile)

    if (sourceFilePaths.length === 0) {
      return []
    }

    const fileArguments = sourceFilePaths.map(quoteShellArgument).join(" ")

    return [`oxfmt ${fileArguments}`, `oxlint ${fileArguments}`]
  },
}
