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
