import { env } from '../config/env';
import { pool } from '../config/db';
import { hashPassword } from '../utils/password';

// Safe to run more than once: existing rows are skipped.
const PROGRAMS = [
  'BS Information Technology',
  'BS Computer Science',
  'BS Business Administration',
  'BS Accountancy',
  'BS Hospitality Management',
  'BS Nursing',
];

const SKILLS = [
  'JavaScript', 'TypeScript', 'Python', 'SQL', 'React', 'Node.js',
  'Communication', 'Customer Service', 'Data Analysis', 'Project Management',
];

async function seed() {
  for (const name of PROGRAMS) {
    await pool.query('INSERT INTO programs (program_name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
  }
  for (const name of SKILLS) {
    await pool.query('INSERT INTO skills (skill_name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
  }
  console.log(`Seeded ${PROGRAMS.length} programs and ${SKILLS.length} skills`);

  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    const hash = await hashPassword(env.ADMIN_PASSWORD);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, role, status)
       VALUES ($1, $2, 'admin', 'active')
       ON CONFLICT (email) DO NOTHING`,
      [env.ADMIN_EMAIL.toLowerCase(), hash],
    );
    console.log(result.rowCount ? `Created admin ${env.ADMIN_EMAIL}` : 'Admin already exists');
  } else {
    console.log('ADMIN_EMAIL / ADMIN_PASSWORD not set: skipped admin account');
  }
}

seed()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
