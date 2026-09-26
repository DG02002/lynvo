import type { DocumentationImageExtension } from "./docs-image-assets"

type ScreenshotExtensionResolver = (
  name: string
) => DocumentationImageExtension | undefined

type ScreenshotReplacementArguments = [
  match: string,
  name: string,
  alt: string,
  ...rest: unknown[],
]

const removeFrontmatter = (content: string) =>
  content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")

const convertNotes = (content: string) =>
  content.replaceAll(
    /<DocsNote title="([^"]+)">\s*([\s\S]*?)\s*<\/DocsNote>/g,
    (_, title: string, note: string) =>
      [
        `> **${title}**`,
        ">",
        ...note
          .trim()
          .split("\n")
          .map((line) => `> ${line}`),
      ].join("\n")
  )

const convertFaqs = (content: string) =>
  content.replaceAll(
    /<DocsFaq question="([^"]+)">\s*([\s\S]*?)\s*<\/DocsFaq>/g,
    (_, question: string, answer: string) =>
      `**${question}**\n\n${answer.trim()}`
  )

const convertScreenshots = (
  content: string,
  getScreenshotExtension: ScreenshotExtensionResolver
) =>
  content.replaceAll(
    /<DocsScreenshot\s+name="([^"]+)"\s+alt="([^"]+)"\s*(?:\/>|>[\s\S]*?<\/DocsScreenshot>)/g,
    (...parts: ScreenshotReplacementArguments) => {
      const [, name, alt] = parts
      const extension = getScreenshotExtension(name)
      return extension ? `![${alt}](images/${name}.${extension})` : ""
    }
  )

export const cleanDocumentationMarkdown = (
  content: string,
  getScreenshotExtension: ScreenshotExtensionResolver = () => undefined
) =>
  convertScreenshots(
    convertFaqs(convertNotes(removeFrontmatter(content))),
    getScreenshotExtension
  )
    .replaceAll(/^<\/?DocSection(?:\s[^>]*)?>\s*$/gm, "")
    .replaceAll(/^<\/?CodeBlock(?:\s[^>]*)?>\s*$/gm, "")
    .replaceAll(/^<\/?(?:DocsFaq|DocsScreenshot)(?:\s[^>]*)?>\s*$/gm, "")
    .replaceAll(/\n{3,}/g, "\n\n")
    .trim()
