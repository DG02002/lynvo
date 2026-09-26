export const removeHtmlLikeTags = (heading: string) => {
  let isInsideTag = false
  let tagContent = ""
  let textWithoutTags = ""

  for (const character of heading) {
    if (character === "<") {
      if (!isInsideTag) {
        isInsideTag = true
        tagContent = ""
      }
      continue
    }

    if (character === ">") {
      if (isInsideTag) {
        isInsideTag = false
        tagContent = ""
      }
      continue
    }

    if (isInsideTag) {
      tagContent += character
      continue
    }

    textWithoutTags += character
  }

  return isInsideTag ? textWithoutTags + tagContent : textWithoutTags
}

export const createHeadingId = (heading: string) =>
  removeHtmlLikeTags(
    heading
      .toLowerCase()
      .replaceAll(/[`*_~]/g, "")
      .replaceAll(/\[([^\]]+)\]\([^)]+\)/g, "$1")
  )
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/(^-|-$)/g, "")

export const getDocumentationHeadings = (
  content: string
): readonly DocumentationHeading[] => {
  const headings: DocumentationHeading[] = []

  for (const line of content.split("\n")) {
    const match = /^(##|###) (.+)$/.exec(line)
    if (!match) {
      continue
    }

    const label = match[2].trim()
    headings.push({
      id: createHeadingId(label),
      label,
      level: match[1] === "###" ? 3 : undefined,
    })
  }

  return headings
}
