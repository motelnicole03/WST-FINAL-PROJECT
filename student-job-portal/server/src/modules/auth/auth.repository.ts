import { PoolClient } from 'pg';
import { query } from '../../config/db';
import { UserRole, UserStatus } from '../../types/roles';

export interface UserRow {
  user_id: number;
  email: string;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
}

export interface UserProfileRow {
  user_id: number;
  email: string;
  role: UserRole;
  status: UserStatus;
  student_id: number | null;
  first_name: string | null;
  last_name: string | null;
  employer_id: number | null;
  company_name: string | null;
  verification_status: string | null;
}

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const rows = await query<UserRow>(
    'SELECT user_id, email, password_hash, role, status FROM users WHERE email = $1',
    [email],
  );
  return rows[0];
}

export async function findUserProfile(userId: number): Promise<UserProfileRow | undefined> {
  const rows = await query<UserProfileRow>(
    `SELECT u.user_id, u.email, u.role, u.status,
            s.student_id, s.first_name, s.last_name,
            e.employer_id, e.company_name, e.verification_status
       FROM users u
       LEFT JOIN students  s ON s.user_id = u.user_id
       LEFT JOIN employers e ON e.user_id = u.user_id
      WHERE u.user_id = $1`,
    [userId],
  );
  return rows[0];
}

// The functions below take a transaction client so registration is all-or-nothing.

export async function insertUser(
  client: PoolClient,
  email: string,
  passwordHash: string,
  role: UserRole,
  status: UserStatus,
): Promise<Pick<UserRow, 'user_id' | 'email' | 'role' | 'status'>> {
  const result = await client.query(
    `INSERT INTO users (email, password_hash, role, status)
     VALUES ($1, $2, $3, $4)
     RETURNING user_id, email, role, status`,
    [email, passwordHash, role, status],
  );
  return result.rows[0];
}

export async function insertStudent(
  client: PoolClient,
  userId: number,
  data: { firstName: string; lastName: string; studentNumber: string; programId: number; yearLevel: number },
) {
  await client.query(
    `INSERT INTO students (user_id, program_id, first_name, last_name, student_number, year_level)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, data.programId, data.firstName, data.lastName, data.studentNumber, data.yearLevel],
  );
}

export async function insertEmployer(
  client: PoolClient,
  userId: number,
  data: { companyName: string; industry?: string; address?: string; contactPerson?: string },
) {
  await client.query(
    `INSERT INTO employers (user_id, company_name, industry, address, contact_person)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, data.companyName, data.industry ?? null, data.address ?? null, data.contactPerson ?? null],
  );
}
