interface FakeD1Outcome {
  readonly row?: unknown
  readonly rows?: unknown[]
  readonly error?: Error
}

export type FakeD1QueryHandler = (
  sql: string,
  args: unknown[]
) => FakeD1Outcome | undefined

interface FakeBoundStatement {
  run: () => Promise<{ meta: { changes: number }; results: unknown[] }>
  first: () => Promise<unknown>
  all: () => Promise<{ results: unknown[] }>
}

const builtInHandler = (sql: string): FakeD1Outcome => {
  if (sql.includes("data_version = data_version + 1")) {
    return { rows: [{ data_version: 2 }] }
  }
  if (sql.includes("SELECT data_version FROM users")) {
    return { row: { data_version: 1 } }
  }
  if (sql.includes("INSERT INTO usage_counters")) {
    return { rows: [{ used: 1 }] }
  }
  return { rows: [] }
}

export const createFakeD1Database = (
  handler: FakeD1QueryHandler
): D1Database => {  const resolve = (sql: string, args: unknown[]): FakeD1Outcome =>
    handler(sql, args) ?? builtInHandler(sql)
  const makeStatement = (sql: string, args: unknown[]) => {
    const execute = async (): Promise<{
      meta: { changes: number }
      results: unknown[]
    }> => {
      const outcome = resolve(sql, args)
      if (outcome.error) {
        throw outcome.error
      }
      return {
        meta: { changes: outcome.rows?.length ?? 0 },
        results: outcome.rows ?? [],
      }
    }
    return {
      run: execute,
      first: async () => {
        const outcome = resolve(sql, args)
        if (outcome.error) {
          throw outcome.error
        }
        return outcome.row ?? null
      },
      all: async () => {
        const outcome = resolve(sql, args)
        if (outcome.error) {
          throw outcome.error
        }
        return { results: outcome.rows ?? [] }
      },
    }
  }
  const prepare = (sql: string) => ({
    ...makeStatement(sql, []),
    bind: (...args: unknown[]) => makeStatement(sql, args),
  })
  return {
    prepare: prepare as unknown as D1Database["prepare"],
    batch: (async (statements: FakeBoundStatement[]) => {
      const results: { meta: { changes: number }; results: unknown[] }[] = []
      for (const statement of statements) {
        results.push(await statement.run())
      }
      return results
    }) as unknown as D1Database["batch"],
  } as D1Database
}
