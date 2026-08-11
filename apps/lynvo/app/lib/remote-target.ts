export const createRemoteTargetId = (sessionId: string, receiverId: string) =>
  `${sessionId}:${receiverId}`

export const parseRemoteTargetId = (targetId: string) => {
  const separatorIndex = targetId.indexOf(":")
  if (separatorIndex <= 0 || separatorIndex === targetId.length - 1) {
    return undefined
  }
  return {
    sessionId: targetId.slice(0, separatorIndex),
    receiverId: targetId.slice(separatorIndex + 1),
  }
}
