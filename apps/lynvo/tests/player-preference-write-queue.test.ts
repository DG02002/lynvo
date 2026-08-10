import { createPlayerPreferenceWriteQueue } from "~/features/site/settings/player-preference-write-queue"

describe("player preference write queue", () => {
  it("does not allow a newer preference write to commit before an older write", async () => {
    const queue = createPlayerPreferenceWriteQueue()
    let finishFirst: (() => void) | undefined
    const commits: string[] = []
    const first = queue.enqueue(
      () =>
        new Promise<void>((resolve) => {
          finishFirst = () => {
            commits.push("first")
            resolve()
          }
        })
    )
    const second = queue.enqueue(async () => {
      commits.push("second")
    })

    await vi.waitFor(() => expect(finishFirst).toBeDefined())
    expect(commits).toEqual([])
    finishFirst?.()
    await Promise.all([first, second])
    expect(commits).toEqual(["first", "second"])
  })
})
