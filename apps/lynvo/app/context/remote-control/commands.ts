import type { Id } from "../../../convex/_generated/dataModel"

declare global {
  interface PendingRemoteCommand {
    _id: Id<"remoteCommands">
    command: "play" | "pause"
    payload: string
    createdAt: number
  }
}

export const processPendingRemoteCommands = async ({
  pendingCommands,
  processedCommandIds,
  machine,
  acknowledge,
}: {
  pendingCommands: PendingRemoteCommand[]
  processedCommandIds: Set<Id<"remoteCommands">>
  machine: RemoteControlMachine
  acknowledge: (id: Id<"remoteCommands">) => Promise<unknown>
}) => {
  const pendingCommandIds = new Set(
    pendingCommands.map((command) => command._id)
  )
  for (const processedCommandId of processedCommandIds) {
    if (!pendingCommandIds.has(processedCommandId)) {
      processedCommandIds.delete(processedCommandId)
    }
  }
  for (const command of pendingCommands) {
    if (processedCommandIds.has(command._id)) {
      continue
    }
    const didAcceptCommand = machine.receiveCommand(
      command.command,
      command.payload,
      command.createdAt,
      command._id
    )
    if (!didAcceptCommand) {
      continue
    }
    processedCommandIds.add(command._id)
    await acknowledge(command._id)
  }
}
