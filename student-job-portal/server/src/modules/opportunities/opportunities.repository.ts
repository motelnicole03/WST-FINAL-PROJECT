import { PoolClient } from 'pg';
import { query } from '../../config/db';
import { ListQuery, OpportunityStatus } from './opportunities.schema';

// ---------- row types ----------

export interface SkillTag {
  id: number;
  name: string;
}

export interface OpportunityDetailRow {
  opportunity_id: number;
  employer_id: number;
  employer_user_id: number;
  employer_verification: string;
  company_name: string;
  program_id: number | null;
  type: string;
  title: string;
  description: string | null;
  requirements: string | null;
  location: string | null;
  work_setup: string | null;
  allowance_salary: number | null;
  slots: number;
  deadline: Date | null;
  status: OpportunityStatus;
  created_at: Date;
  skills: SkillTag[];
}

export interface OpportunityListRow {
  opportunity_id: number;
  type: string;
  title: string;
  location: string | null;
  work_setup: string | null;
  allowance_salary: number | null;
  slots: number;
  deadline: Date | null;
  created_at: Date;
  employer_id: number;
  company_name: string;
  skills: SkillTag[];
  total: number;
}

// ---------- shared SQL ----------

const SKILLS_JSON = `
  COALESCE((
    SELECT json_agg(json_build_object('id', s.skill_id, 'name', s.skill_name) ORDER BY s.skill_name)
      FROM opportunity_skills os
      JOIN skills s ON s.skill_id = os.skill_id
     WHERE os.opportunity_id = o.opportunity_id
  ), '[]'::json)`;

// NUMERIC comes back from pg as a string, so cast it to a number in SQL.
const LIST_COLUMNS = `
  o.opportunity_id, o.type, o.title, o.location, o.work_setup,
  o.allowance_salary::float8 AS allowance_salary,
  o.slots, o.deadline, o.created_at,
  e.employer_id, e.company_name,
  ${SKILLS_JSON} AS skills`;

const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

// ---------- people lookups ----------

export async function findEmployerByUserId(userId: number) {
  const rows = await query<{ employer_id: number; verification_status: string }>(
    'SELECT employer_id, verification_status FROM employers WHERE user_id = $1',
    [userId],
  );
  return rows[0];
}

export async function findStudentIdByUserId(userId: number) {
  const rows = await query<{ student_id: number }>(
    'SELECT student_id FROM students WHERE user_id = $1',
    [userId],
  );
  return rows[0]?.student_id;
}

// ---------- reading ----------

export async function findById(id: number): Promise<OpportunityDetailRow | undefined> {
  const rows = await query<OpportunityDetailRow>(
    `SELECT o.opportunity_id, o.employer_id, e.user_id AS employer_user_id,
            e.verification_status AS employer_verification, e.company_name,
            o.program_id, o.type, o.title, o.description, o.requirements, o.location,
            o.work_setup, o.allowance_salary::float8 AS allowance_salary, o.slots,
            o.deadline, o.status, o.created_at,
            ${SKILLS_JSON} AS skills
       FROM opportunities o
       JOIN employers e ON e.employer_id = o.employer_id
      WHERE o.opportunity_id = $1`,
    [id],
  );
  return rows[0];
}

/** Public listing: open, not past deadline, from verified employers. */
export async function listOpen(f: ListQuery): Promise<OpportunityListRow[]> {
  const where = [
    `o.status = 'open'`,
    `(o.deadline IS NULL OR o.deadline > now())`,
    `e.verification_status = 'verified'`,
  ];
  const params: unknown[] = [];
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (f.q) {
    const p = add(`%${escapeLike(f.q)}%`);
    where.push(`(o.title ILIKE ${p} OR o.description ILIKE ${p} OR e.company_name ILIKE ${p})`);
  }
  if (f.type) where.push(`o.type = ${add(f.type)}`);
  if (f.workSetup) where.push(`o.work_setup = ${add(f.workSetup)}`);
  if (f.location) where.push(`o.location ILIKE ${add(`%${escapeLike(f.location)}%`)}`);
  // An opportunity with no target program is open to every program
  if (f.programId) {
    const p = add(f.programId);
    where.push(`(o.program_id = ${p} OR o.program_id IS NULL)`);
  }
  if (f.skillId) {
    where.push(
      `EXISTS (SELECT 1 FROM opportunity_skills os
                WHERE os.opportunity_id = o.opportunity_id AND os.skill_id = ${add(f.skillId)})`,
    );
  }

  const orderBy =
    f.sort === 'deadline'
      ? 'o.deadline ASC NULLS LAST, o.opportunity_id DESC'
      : 'o.created_at DESC, o.opportunity_id DESC';
  const limit = add(f.limit);
  const offset = add((f.page - 1) * f.limit);

  return query<OpportunityListRow>(
    `SELECT ${LIST_COLUMNS}, COUNT(*) OVER() AS total
       FROM opportunities o
       JOIN employers e ON e.employer_id = o.employer_id
      WHERE ${where.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
}

export async function listByEmployer(employerId: number) {
  return query(
    `SELECT o.opportunity_id, o.type, o.title, o.status, o.slots, o.deadline, o.created_at,
            (SELECT COUNT(*) FROM applications a WHERE a.opportunity_id = o.opportunity_id) AS applications_count
       FROM opportunities o
      WHERE o.employer_id = $1
      ORDER BY o.created_at DESC`,
    [employerId],
  );
}

export async function listPendingApproval() {
  return query(
    `SELECT o.opportunity_id, o.type, o.title, o.created_at, e.employer_id, e.company_name
       FROM opportunities o
       JOIN employers e ON e.employer_id = o.employer_id
      WHERE o.status = 'pending_approval'
      ORDER BY o.created_at`,
  );
}

// ---------- writing (these take a transaction client) ----------

export interface NewOpportunity {
  type: string;
  title: string;
  description?: string;
  requirements?: string;
  location?: string;
  workSetup?: string;
  allowanceSalary?: number;
  slots: number;
  deadline?: string;
  programId?: number;
}

export async function insertOpportunity(client: PoolClient, employerId: number, d: NewOpportunity) {
  const result = await client.query(
    `INSERT INTO opportunities
       (employer_id, program_id, type, title, description, requirements, location,
        work_setup, allowance_salary, slots, deadline, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft')
     RETURNING opportunity_id`,
    [
      employerId, d.programId ?? null, d.type, d.title, d.description ?? null,
      d.requirements ?? null, d.location ?? null, d.workSetup ?? null,
      d.allowanceSalary ?? null, d.slots, d.deadline ?? null,
    ],
  );
  return result.rows[0].opportunity_id as number;
}

// Request field name -> column name. Only these can ever be written.
const UPDATABLE_COLUMNS: Record<string, string> = {
  type: 'type',
  title: 'title',
  description: 'description',
  requirements: 'requirements',
  location: 'location',
  workSetup: 'work_setup',
  allowanceSalary: 'allowance_salary',
  slots: 'slots',
  deadline: 'deadline',
  programId: 'program_id',
};

export async function updateOpportunity(client: PoolClient, id: number, patch: Record<string, unknown>) {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [field, column] of Object.entries(UPDATABLE_COLUMNS)) {
    if (patch[field] !== undefined) {
      params.push(patch[field]);
      sets.push(`${column} = $${params.length}`);
    }
  }
  if (sets.length === 0) return;
  params.push(id);
  await client.query(
    `UPDATE opportunities SET ${sets.join(', ')} WHERE opportunity_id = $${params.length}`,
    params,
  );
}

export async function replaceSkills(client: PoolClient, opportunityId: number, skillIds: number[]) {
  await client.query('DELETE FROM opportunity_skills WHERE opportunity_id = $1', [opportunityId]);
  if (skillIds.length > 0) {
    await client.query(
      `INSERT INTO opportunity_skills (opportunity_id, skill_id)
       SELECT $1, unnest($2::bigint[])
       ON CONFLICT DO NOTHING`,
      [opportunityId, skillIds],
    );
  }
}

export async function setStatus(id: number, status: OpportunityStatus) {
  await query('UPDATE opportunities SET status = $1 WHERE opportunity_id = $2', [status, id]);
}

// ---------- saved opportunities and analytics ----------

export async function saveOpportunity(studentId: number, opportunityId: number) {
  await query(
    `INSERT INTO saved_opportunities (student_id, opportunity_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [studentId, opportunityId],
  );
}

export async function unsaveOpportunity(studentId: number, opportunityId: number) {
  await query('DELETE FROM saved_opportunities WHERE student_id = $1 AND opportunity_id = $2', [
    studentId,
    opportunityId,
  ]);
}

export async function listSaved(studentId: number) {
  return query(
    `SELECT ${LIST_COLUMNS}, o.status, so.saved_at
       FROM saved_opportunities so
       JOIN opportunities o ON o.opportunity_id = so.opportunity_id
       JOIN employers e ON e.employer_id = o.employer_id
      WHERE so.student_id = $1
      ORDER BY so.saved_at DESC`,
    [studentId],
  );
}

export async function recordView(userId: number | null, opportunityId: number) {
  await query(
    `INSERT INTO analytics_events (user_id, opportunity_id, event_type) VALUES ($1, $2, 'view')`,
    [userId, opportunityId],
  );
}
