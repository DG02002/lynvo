import type { DocumentationImageExtension } from "./docs-image-assets"

interface MarkdownSection {
  content: string
  level?: 2 | 3
  title: string
}

type ScreenshotExtensionResolver = (
  name: string
) => DocumentationImageExtension | undefined

type ScreenshotReplacementArguments = [
  component: string,
  name: string,
  alt: string,
  caption: string,
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
    /<DocsScreenshot\s+name="([^"]+)"\s+alt="([^"]+)"\s*>([\s\S]*?)<\/DocsScreenshot>/g,
    (...parts: ScreenshotReplacementArguments) => {
      const [, name, alt, caption] = parts
      const extension = getScreenshotExtension(name) ?? "png"
      const image = `![${alt}](images/${name}.${extension})`
      const trimmedCaption = caption.trim()
      return trimmedCaption ? `${image}\n\n*${trimmedCaption}*` : image
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

export const extractDocumentationSection = (content: string, id: string) => {
  const match = new RegExp(
    `<DocSection id="${id}">\\s*([\\s\\S]*?)\\s*</DocSection>`
  ).exec(removeFrontmatter(content))
  return match?.[1].trim() ?? ""
}

export const assembleDocumentationMarkdown = ({
  description,
  introduction,
  sections,
  title,
}: {
  description: string
  introduction: string
  sections: readonly MarkdownSection[]
  title: string
}) =>
  [
    `# ${title}`,
    description,
    introduction,
    ...sections.map(
      (section) =>
        `${"#".repeat(section.level ?? 2)} ${section.title}\n\n${cleanDocumentationMarkdown(section.content)}`
    ),
  ]
    .filter(Boolean)
    .join("\n\n")
    .concat("\n")
