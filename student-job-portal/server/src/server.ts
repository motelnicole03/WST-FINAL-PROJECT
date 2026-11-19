import { app } from './app';
import { env } from './config/env';
import { pool } from './config/db';

async function start() {
  // Fail fast if the database is unreachable
  await pool.query('SELECT 1');
  console.log('Connected to PostgreSQL');

  const server = app.listen(env.PORT, () => {
    console.log(`API running on http://localhost:${env.PORT}`);
  });

  const shutdown = () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
