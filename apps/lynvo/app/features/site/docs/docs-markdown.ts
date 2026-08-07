interface MarkdownSection {
  content: string
  level?: 2 | 3
  title: string
}

const removeFrontmatter = (content: string) =>
  content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")

const convertNotes = (content: string) =>
  content.replace(
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

export const cleanDocumentationMarkdown = (content: string) =>
  convertNotes(removeFrontmatter(content))
    .replace(/^<\/?DocSection(?:\s[^>]*)?>\s*$/gm, "")
    .replace(/^<\/?CodeBlock(?:\s[^>]*)?>\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
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
