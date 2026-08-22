export const createDataVersionBumpStatement = (
  database: D1Database,
  userId: string
): D1PreparedStatement =>
  database
    .prepare(
      "UPDATE users SET data_version = data_version + 1 WHERE id = ?1 RETURNING data_version"
    )
    .bind(userId)

interface DataVersionBumpRow {
  readonly data_version: number
}

export interface OwnedWriteResult {
  dataVersion: number
  statementResults: readonly D1Result<unknown>[]
}

export const executeOwnedWrite = async (
  database: D1Database,
  userId: string,
  statements: readonly D1PreparedStatement[]
): Promise<OwnedWriteResult> => {
  if (statements.length === 0) {
    return {
      dataVersion: await getDataVersion(database, userId),
      statementResults: [],
    }
  }
  const results = await database.batch([
    ...statements,
    createDataVersionBumpStatement(database, userId),
  ])
  const bumpResult = results[results.length - 1]
  // SAFETY: the bump statement always returns exactly one row for an existing user.
  const bumpRow = bumpResult.results?.[0] as DataVersionBumpRow | undefined
  if (!bumpRow) {
    throw new Error("Data version bump failed")
  }
  return { dataVersion: bumpRow.data_version, statementResults: results }
}

export const getDataVersion = async (
  database: D1Database,
  userId: string
): Promise<number> => {
  const row = await database
    .prepare("SELECT data_version FROM users WHERE id = ?1")
    .bind(userId)
    .first<{ readonly data_version: number }>()
  return row?.data_version ?? 0
}
