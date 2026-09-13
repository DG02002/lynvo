interface OwnedRow {
  user_id: string
}

type OwnedRowErrorFactory = () => Error

export interface OwnedRowSource {
  /** SQL fragments are declared by the caller; neither value contains user input. */
  readonly table: string
  readonly columns: string
}

interface RequireOwnedRowInput {
  readonly database: D1Database
  readonly source: OwnedRowSource
  readonly id: string
  readonly userId: string
  readonly createError: OwnedRowErrorFactory
}

export const requireOwnedRow = async <Row extends OwnedRow>({
  database,
  source,
  id,
  userId,
  createError,
}: RequireOwnedRowInput): Promise<Row> => {
  const row = await database
    .prepare(`SELECT ${source.columns} FROM ${source.table} WHERE id = ?1`)
    .bind(id)
    .first<Row>()
  if (!row || row.user_id !== userId) {
    throw createError()
  }
  return row
}
