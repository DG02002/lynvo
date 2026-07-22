import type { Id } from "../convex/_generated/dataModel"
import { processPendingRemoteCommands } from "~/context/remote-control/commands"

describe("remote command subscription", () => {
  it("accepts and acknowledges a reactive command exactly once", async () => {
    const commandId = "remote-command-id" as Id<"remoteCommands">
    const receiveCommand = vi.fn(() => true)
    const acknowledge = vi.fn(async () => undefined)
    const processedCommandIds = new Set<Id<"remoteCommands">>()
    const machine = {
      receiveCommand,
    } as RemoteControlMachine
    const pendingCommands: PendingRemoteCommand[] = [
      {
        _id: commandId,
        command: "play",
        payload: '{"url":"https://example.com"}',
        createdAt: 1,
      },
    ]

    await processPendingRemoteCommands({
      pendingCommands,
      processedCommandIds,
      machine,
      acknowledge,
    })
    await processPendingRemoteCommands({
      pendingCommands,
      processedCommandIds,
      machine,
      acknowledge,
    })

    expect(receiveCommand).toHaveBeenCalledOnce()
    expect(acknowledge).toHaveBeenCalledOnce()
    expect(acknowledge).toHaveBeenCalledWith(commandId)
  })
})
