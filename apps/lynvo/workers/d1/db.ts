export const getD1Database = (env: Env): D1Database | undefined =>
  // SAFETY: generated Env types DB as required, but runtimes deployed before the binding exist lack it.
  (env as { DB?: D1Database }).DB
