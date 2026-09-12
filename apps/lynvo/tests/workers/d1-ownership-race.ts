export interface D1OwnershipReadPause {
  database: D1Database
  waitForRead(originalPromise: Promise<unknown>): Promise<void>
  resume(): void
}

export const createD1OwnershipReadPause = (
  database: D1Database,
  input: { queryFragment: string; rowId: string; label: string }
): D1OwnershipReadPause => {
  let readReached!: () => void
  const readReachedPromise = new Promise<void>((resolve) => {
    readReached = resolve
  })
  let resume!: () => void
  const resumePromise = new Promise<void>((resolve) => {
    resume = resolve
  })
  let paused = false
  const prepare = database.prepare.bind(database)
  const pausedDatabase = {
    prepare(query: string): D1PreparedStatement {
      const statement = prepare(query)
      if (!query.includes(input.queryFragment)) {
        return statement
      }
      const decoratedStatement = {
        bind(...values: unknown[]) {
          const bound = statement.bind(...values)
          if (values[0] !== input.rowId) {
            return bound
          }
          const pausedStatement = {
            async first<Result>() {
              const result = await bound.first<Result>()
              if (!paused) {
                paused = true
                readReached()
                await resumePromise
              }
              return result
            },
          }
          // SAFETY: the targeted read only calls bind().first().
          return pausedStatement as D1PreparedStatement
        },
      }
      // SAFETY: the test wrapper only decorates prepare().bind().
      return decoratedStatement as D1PreparedStatement
    },
    batch: database.batch.bind(database),
  }
  // SAFETY: public operations under test only use prepare() and batch().
  const pausedD1 = pausedDatabase as D1Database
  return {
    database: pausedD1,
    waitForRead: async (originalPromise: Promise<unknown>): Promise<void> => {
      const outcome = await Promise.race([
        readReachedPromise.then(() => "paused" as const),
        originalPromise.then(
          () => "original-finished" as const,
          () => "original-finished" as const
        ),
      ])
      if (outcome === "original-finished") {
        throw new Error(`${input.label} pause did not observe the read`)
      }
    },
    resume,
  }
}
