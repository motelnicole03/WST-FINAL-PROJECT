import { camelize } from '../../utils/camelize';
import { HttpError } from '../../utils/httpError';
import * as repo from './admin.repository';

export async function listEmployers(status: repo.VerificationStatus) {
  return camelize(await repo.listEmployersByStatus(status));
}

export async function setVerification(employerId: number, status: 'verified' | 'rejected') {
  const employer = await repo.setEmployerVerification(employerId, status);
  if (!employer) throw HttpError.notFound('Employer not found');
  return camelize(employer);
}
