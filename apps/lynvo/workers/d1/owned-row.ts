interface OwnedRow {
  user_id: string
}

type OwnedRowErrorFactory = () => Error

export interface OwnedRowSource {
  /** SQL fragments are declared by the caller; neither value contains user input. */
  readonly table: string
  readonly columns: string
}

interface OwnedRowLookupInput {
  readonly database: D1Database
  readonly source: OwnedRowSource
  readonly id: string
  readonly userId: string
}

interface RequireOwnedRowInput extends OwnedRowLookupInput {
  readonly createError: OwnedRowErrorFactory
}

export const findOwnedRow = async <Row extends OwnedRow>({
  database,
  source,
  id,
  userId,
}: OwnedRowLookupInput): Promise<Row | null> => {
  const row = await database
    .prepare(`SELECT ${source.columns} FROM ${source.table} WHERE id = ?1`)
    .bind(id)
    .first<Row>()
  return row && row.user_id === userId ? row : null
}

export const requireOwnedRow = async <Row extends OwnedRow>({
  createError,
  ...input
}: RequireOwnedRowInput): Promise<Row> => {
  const row = await findOwnedRow<Row>(input)
  if (!row) {
    throw createError()
  }
  return row
}
