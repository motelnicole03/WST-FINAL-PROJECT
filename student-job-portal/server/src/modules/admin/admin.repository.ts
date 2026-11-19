import { query } from '../../config/db';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export async function listEmployersByStatus(status: VerificationStatus) {
  return query(
    `SELECT e.employer_id, e.company_name, e.industry, e.contact_person,
            e.verification_status, u.email, u.created_at
       FROM employers e
       JOIN users u ON u.user_id = e.user_id
      WHERE e.verification_status = $1
      ORDER BY u.created_at`,
    [status],
  );
}

export async function setEmployerVerification(employerId: number, status: VerificationStatus) {
  const rows = await query(
    `UPDATE employers SET verification_status = $1
      WHERE employer_id = $2
  RETURNING employer_id, company_name, verification_status`,
    [status, employerId],
  );
  return rows[0];
}
