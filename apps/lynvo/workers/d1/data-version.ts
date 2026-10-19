import { notifyAccountDataChanged } from "./data-version-notification"

export interface OwnedWriteGuard {
  /**
   * EXISTS subquery tied to the post-state of the guarded write. Placeholder
   * numbering is owned by the statement that embeds the subquery; the
   * version bump binds the user id at ?1 followed by the guard bindings.
   */
  readonly conditionSql: string
  readonly conditionBindings: readonly unknown[]
}

// The guarded write must be the statement immediately before the version bump.
export const CHANGED_ROWS_GUARD: OwnedWriteGuard = {
  conditionSql: "SELECT 1 WHERE changes() > 0",
  conditionBindings: [],
}

export const createChangedWriteGuard = (
  guard: OwnedWriteGuard
): OwnedWriteGuard => ({
  conditionSql: `${CHANGED_ROWS_GUARD.conditionSql} AND EXISTS (${guard.conditionSql})`,
  conditionBindings: guard.conditionBindings,
})

const createDataVersionBumpStatement = (
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
  statementResults: readonly D1Result[]
  changed: boolean
}

interface ExecuteOwnedWriteInput {
  readonly database: D1Database
  readonly userId: string
  readonly statements: readonly D1PreparedStatement[]
  readonly guard?: OwnedWriteGuard
  readonly realtime?: DurableObjectNamespace
  readonly notify?: boolean
}

interface OwnedWriteBatchInput {
  readonly userId: string
  readonly statements: readonly D1PreparedStatement[]
  readonly guard?: OwnedWriteGuard
  readonly notify?: boolean
}

interface ExecuteOwnedWriteBatchInput {
  readonly database: D1Database
  readonly writes: readonly OwnedWriteBatchInput[]
  readonly realtime?: DurableObjectNamespace
}

interface OwnedWriteBatchRange {
  readonly start: number
  readonly end: number
}

export const executeOwnedWriteBatch = async ({
  database,
  writes,
  realtime,
}: ExecuteOwnedWriteBatchInput): Promise<OwnedWriteResult[]> => {
  const statements: D1PreparedStatement[] = []
  const ranges: Array<OwnedWriteBatchRange | undefined> = []
  for (const write of writes) {
    if (write.statements.length === 0) {
      ranges.push(undefined)
      continue
    }
    const start = statements.length
    statements.push(
      ...write.statements,
      createDataVersionBumpStatement(database, write.userId, write.guard)
    )
    ranges.push({ start, end: statements.length })
  }
  const batchResults =
    statements.length === 0 ? [] : await database.batch(statements)
  const writeResults = await Promise.all(
    writes.map(async (write, index): Promise<OwnedWriteResult> => {
      const range = ranges[index]
      if (!range) {
        return {
          dataVersion: await getDataVersion(database, write.userId),
          statementResults: [],
          changed: false,
        }
      }
      const statementResults = batchResults.slice(range.start, range.end)
      const bumpResult = statementResults[statementResults.length - 1]
      // SAFETY: every non-empty write appends exactly one version bump.
      const bumpRow = bumpResult?.results?.[0] as DataVersionBumpRow | undefined
      if (!bumpRow) {
        if (write.guard) {
          return {
            dataVersion: await getDataVersion(database, write.userId),
            statementResults,
            changed: false,
          }
        }
        throw new Error("Data version bump failed")
      }
      return {
        dataVersion: bumpRow.data_version,
        statementResults,
        changed: true,
      }
    })
  )
  if (realtime) {
    await Promise.all(
      writeResults.map(async (result, index) => {
        const write = writes[index]
        if (!result.changed || write?.notify === false) {
          return
        }
        await notifyAccountDataChanged(
          realtime,
          write.userId,
          result.dataVersion
        ).catch(() => {
          console.warn("data_changed_push_failed", {
            user_id: write.userId,
            version: result.dataVersion,
          })
        })
      })
    )
  }
  return writeResults
}

export const executeOwnedWrite = async ({
  database,
  userId,
  statements,
  guard,
  realtime,
  notify,
}: ExecuteOwnedWriteInput): Promise<OwnedWriteResult> => {
  const [result] = await executeOwnedWriteBatch({
    database,
    realtime,
    writes: [{ userId, statements, guard, notify }],
  })
  if (!result) {
    throw new Error("Owned write result is missing")
  }
  return result
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
