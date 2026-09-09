export const runAfterSessionIdentity = async <Result>(
  ensureSessionIdentity: () => Promise<boolean>,
  task: () => Promise<Result>
): Promise<Result | null> => {
  if (!(await ensureSessionIdentity())) {
    return null
  }
  return task()
}
