import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../config/db';

// Runs every .sql file in ./migrations once, in filename order (001_..., 002_...).
// To change the schema later, add a new file such as 002_add_something.sql.
async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const done = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
    if (done.rowCount) {
      console.log(`skip   ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`apply  ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`FAILED ${file}`);
      throw error;
    } finally {
      client.release();
    }
  }
}

migrate()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
