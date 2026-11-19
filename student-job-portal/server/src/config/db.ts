import { Pool, PoolClient, QueryResultRow, types } from 'pg';
import { env } from './env';

// PostgreSQL returns BIGINT (type 20) as a string by default.
// Our ids are small enough to be safe as JavaScript numbers.
types.setTypeParser(20, (value) => Number(value));

export const pool = new Pool({ connectionString: env.DATABASE_URL });

/** Run a query and return the rows. Pass user input only through `params`. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

/** Run several queries as one unit: all succeed, or all are rolled back. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
