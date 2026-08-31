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
      .replace(/[`*_~]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
  )
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
