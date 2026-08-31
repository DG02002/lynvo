export interface OwnedWriteGuard {
  /**
   * EXISTS subquery tied to the post-state of the guarded write. Placeholders
   * are numbered from ?2 (?1 is always the user id).
   */
  readonly conditionSql: string
  readonly conditionBindings: readonly unknown[]
}

export const createDataVersionBumpStatement = (
  database: D1Database,
  userId: string,
  guard?: OwnedWriteGuard
): D1PreparedStatement =>
  guard
    ? database
        .prepare(
          `UPDATE users SET data_version = data_version + 1 WHERE id = ?1 AND EXISTS (${guard.conditionSql}) RETURNING data_version`
        )
        .bind(userId, ...guard.conditionBindings)
    : database
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
  changed: boolean
}

interface ExecuteOwnedWriteInput {
  readonly database: D1Database
  readonly userId: string
  readonly statements: readonly D1PreparedStatement[]
  readonly guard?: OwnedWriteGuard
}

export const executeOwnedWrite = async ({
  database,
  userId,
  statements,
  guard,
}: ExecuteOwnedWriteInput): Promise<OwnedWriteResult> => {
  if (statements.length === 0) {
    return {
      dataVersion: await getDataVersion(database, userId),
      statementResults: [],
      changed: false,
    }
  }
  const results = await database.batch([
    ...statements,
    createDataVersionBumpStatement(database, userId, guard),
  ])
  const bumpResult = results[results.length - 1]
  // SAFETY: the bump statement always returns exactly one row for an existing user.
  const bumpRow = bumpResult.results?.[0] as DataVersionBumpRow | undefined
  if (!bumpRow) {
    if (guard) {
      return {
        dataVersion: await getDataVersion(database, userId),
        statementResults: results,
        changed: false,
      }
    }
    throw new Error("Data version bump failed")
  }
  return {
    dataVersion: bumpRow.data_version,
    statementResults: results,
    changed: true,
  }
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
