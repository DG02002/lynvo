import { existsSync } from "node:fs"
import { relative, sep } from "node:path"

const sourceFilePattern = /\.(?:c|m)?[jt]sx?$/

const getRelativePath = (absolutePath) =>
  relative(process.cwd(), absolutePath).split(sep).join("/")

const isLintableSourceFile = (absolutePath) => {
  const relativePath = getRelativePath(absolutePath)

  return existsSync(absolutePath) && sourceFilePattern.test(relativePath)
}

const quoteShellArgument = (filePath) =>
  `'${filePath.replaceAll("'", "'\\''")}'`

const jsonFilePattern = /(?:^|\/)(?:package|knip)\.json$/

export default {
  "*": (stagedFilePaths) => {
    const sourceFilePaths = stagedFilePaths.filter(isLintableSourceFile)
    const jsonFilePaths = stagedFilePaths.filter(
      (absolutePath) =>
        existsSync(absolutePath) &&
        jsonFilePattern.test(getRelativePath(absolutePath))
    )

    const commands = []

    if (sourceFilePaths.length > 0) {
      const fileArguments = sourceFilePaths.map(quoteShellArgument).join(" ")
      commands.push(
        `oxfmt --no-error-on-unmatched-pattern ${fileArguments}`,
        `oxlint --no-error-on-unmatched-pattern ${fileArguments}`
      )
    }

    if (jsonFilePaths.length > 0) {
      const fileArguments = jsonFilePaths.map(quoteShellArgument).join(" ")
      commands.push(`oxfmt --no-error-on-unmatched-pattern ${fileArguments}`)
    }

    return commands
  },
}
