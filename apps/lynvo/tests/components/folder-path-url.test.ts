import { describe, expect, it } from "vitest"
import type { ExtractedLink } from "~/features/links/types"
import {
  createFolderPathSearch,
  encodeFolderPath,
  parseFolderPath,
  resolveFolderPath,
} from "~/components/save-list/folder-path-url"

describe("folder path URL helpers", () => {
  it("round-trips opaque ids that contain URL-reserved characters", () => {
    const folderPath = [
      { id: "parent/id+%", label: "Parent" },
      { id: "child?name", label: "Child" },
    ]

    const encodedPath = encodeFolderPath(folderPath)

    expect(encodedPath).toBe("parent%2Fid%2B%25/child%3Fname")
    expect(parseFolderPath(`?path=${encodedPath}`)).toEqual({
      hasSearchParam: true,
      ids: ["parent/id+%", "child?name"],
      isMalformed: false,
    })
  })

  it("preserves unrelated search params while replacing the folder path", () => {
    expect(
      createFolderPathSearch("?group=movies&path=old", [
        { id: "new-folder", label: "New Folder" },
      ])
    ).toBe("?group=movies&path=new-folder")
    expect(createFolderPathSearch("?group=movies&path=old", [])).toBe(
      "?group=movies"
    )
  })

  it("resolves only the valid prefix of a stale path", () => {
    const links: ExtractedLink[] = [
      {
        id: "folder-one",
        url: "https://media.example/folder-one",
        label: "Folder One",
        mediaNodeKind: "group",
        type: "folder",
        children: [],
      },
    ]

    expect(resolveFolderPath(links, ["folder-one", "missing-folder"])).toEqual([
      { id: "folder-one", label: "Folder One" },
    ])
  })
})
