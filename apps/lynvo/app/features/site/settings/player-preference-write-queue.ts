export const createPlayerPreferenceWriteQueue = () => {
  let pending: Promise<unknown> = Promise.resolve()
  return {
    enqueue: <Result>(operation: () => Promise<Result>) => {
      const result = pending.catch(() => undefined).then(operation)
      pending = result.catch(() => undefined)
      return result
    },
  }
}
