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

export const createRemoteClaimId = (commandId: string, claimToken: string) =>
  `${commandId}:${claimToken}`

export const parseRemoteClaimId = (claimId: string) => {
  const separatorIndex = claimId.indexOf(":")
  if (separatorIndex <= 0 || separatorIndex === claimId.length - 1) {
    return undefined
  }
  return {
    commandId: claimId.slice(0, separatorIndex),
    claimToken: claimId.slice(separatorIndex + 1),
  }
}
