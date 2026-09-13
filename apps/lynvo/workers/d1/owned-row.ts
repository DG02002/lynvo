interface OwnedRow {
  user_id: string
}

type OwnedRowErrorFactory = () => Error

export const requireOwnedRow = async <Row extends OwnedRow>(
  database: D1Database,
  table: string,
  columns: string,
  id: string,
  userId: string,
  message: string,
  createError: OwnedRowErrorFactory = () => new Error(message)
): Promise<Row> => {
  const row = await database
    .prepare(`SELECT ${columns} FROM ${table} WHERE id = ?1`)
    .bind(id)
    .first<Row>()
  if (!row || row.user_id !== userId) {
    throw createError()
  }
  return row
}
