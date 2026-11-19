import { withTransaction } from '../../config/db';
import { camelize } from '../../utils/camelize';
import { HttpError } from '../../utils/httpError';
import { TokenPayload } from '../../utils/jwt';
import * as repo from './opportunities.repository';
import {
  CreateOpportunityInput,
  ListQuery,
  UpdateOpportunityInput,
} from './opportunities.schema';

// ---------- helpers ----------

function assertFutureDeadline(deadline?: string) {
  if (deadline && new Date(deadline).getTime() <= Date.now()) {
    throw HttpError.badRequest('Deadline must be in the future');
  }
}

/** The employer profile for a logged-in employer, who must also be verified by an admin. */
async function requireVerifiedEmployer(user: TokenPayload) {
  const employer = await repo.findEmployerByUserId(user.userId);
  if (!employer) throw HttpError.forbidden('Employer profile not found');
  if (employer.verification_status !== 'verified') {
    throw HttpError.forbidden('Your company must be verified by an admin before you can post');
  }
  return employer;
}

/** Loads an opportunity the caller owns. Others get a 404 so ids cannot be probed. */
async function getOwnedOrThrow(user: TokenPayload, id: number) {
  const opportunity = await repo.findById(id);
  if (!opportunity || opportunity.employer_user_id !== user.userId) {
    throw HttpError.notFound('Opportunity not found');
  }
  return opportunity;
}

// ---------- public / student ----------

export async function listOpen(filters: ListQuery) {
  const rows = await repo.listOpen(filters);
  const total = rows[0]?.total ?? 0;
  return {
    data: camelize(rows.map(({ total: _total, ...row }) => row)),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}

export async function getOne(id: number, viewer?: TokenPayload) {
  const row = await repo.findById(id);

  const isPublic = row?.status === 'open' && row.employer_verification === 'verified';
  const isOwner = !!row && !!viewer && row.employer_user_id === viewer.userId;
  const isAdmin = viewer?.role === 'admin';
  if (!row || (!isPublic && !isOwner && !isAdmin)) {
    throw HttpError.notFound('Opportunity not found');
  }

  // Count views from everyone except the owning employer and admins. Never block on this.
  if (!isOwner && !isAdmin) {
    repo.recordView(viewer?.userId ?? null, id).catch((error) => console.error('recordView failed', error));
  }

  const { employer_user_id: _owner, employer_verification: _verified, ...detail } = row;
  return camelize(detail);
}

export async function saveForStudent(user: TokenPayload, opportunityId: number) {
  const studentId = await repo.findStudentIdByUserId(user.userId);
  if (!studentId) throw HttpError.forbidden('Student profile not found');

  const opportunity = await repo.findById(opportunityId);
  if (!opportunity || opportunity.status !== 'open') {
    throw HttpError.notFound('Opportunity not found');
  }
  await repo.saveOpportunity(studentId, opportunityId);
}

export async function unsaveForStudent(user: TokenPayload, opportunityId: number) {
  const studentId = await repo.findStudentIdByUserId(user.userId);
  if (!studentId) throw HttpError.forbidden('Student profile not found');
  await repo.unsaveOpportunity(studentId, opportunityId);
}

export async function listSaved(user: TokenPayload) {
  const studentId = await repo.findStudentIdByUserId(user.userId);
  if (!studentId) throw HttpError.forbidden('Student profile not found');
  return camelize(await repo.listSaved(studentId));
}

// ---------- employer ----------

export async function create(user: TokenPayload, input: CreateOpportunityInput) {
  const employer = await requireVerifiedEmployer(user);
  assertFutureDeadline(input.deadline);

  const id = await withTransaction(async (client) => {
    const newId = await repo.insertOpportunity(client, employer.employer_id, {
      ...input,
      slots: input.slots ?? 1,
    });
    if (input.skillIds?.length) await repo.replaceSkills(client, newId, input.skillIds);
    return newId;
  });

  return getOne(id, user);
}

export async function update(user: TokenPayload, id: number, input: UpdateOpportunityInput) {
  const opportunity = await getOwnedOrThrow(user, id);
  if (opportunity.status === 'closed' || opportunity.status === 'filled') {
    throw HttpError.conflict('A closed opportunity cannot be edited');
  }
  assertFutureDeadline(input.deadline);

  const { skillIds, ...fields } = input;
  await withTransaction(async (client) => {
    await repo.updateOpportunity(client, id, fields);
    if (skillIds) await repo.replaceSkills(client, id, skillIds);
  });

  return getOne(id, user);
}

/** draft -> pending_approval: sends the posting to an admin for review. */
export async function submit(user: TokenPayload, id: number) {
  await requireVerifiedEmployer(user);
  const opportunity = await getOwnedOrThrow(user, id);
  if (opportunity.status !== 'draft') {
    throw HttpError.conflict(`Only drafts can be submitted (this one is ${opportunity.status})`);
  }
  await repo.setStatus(id, 'pending_approval');
  return getOne(id, user);
}

export async function close(user: TokenPayload, id: number) {
  const opportunity = await getOwnedOrThrow(user, id);
  if (opportunity.status === 'closed' || opportunity.status === 'filled') {
    throw HttpError.conflict('This opportunity is already closed');
  }
  await repo.setStatus(id, 'closed');
  return getOne(id, user);
}

export async function listMine(user: TokenPayload) {
  const employer = await repo.findEmployerByUserId(user.userId);
  if (!employer) throw HttpError.forbidden('Employer profile not found');
  return camelize(await repo.listByEmployer(employer.employer_id));
}

// ---------- admin ----------

export async function listPending() {
  return camelize(await repo.listPendingApproval());
}

export async function approve(admin: TokenPayload, id: number) {
  const opportunity = await repo.findById(id);
  if (!opportunity) throw HttpError.notFound('Opportunity not found');
  if (opportunity.status !== 'pending_approval') {
    throw HttpError.conflict(`Only pending opportunities can be approved (this one is ${opportunity.status})`);
  }
  await repo.setStatus(id, 'open');
  return getOne(id, admin);
}

/** Sends a pending posting back to draft so the employer can fix and resubmit it. */
export async function reject(admin: TokenPayload, id: number) {
  const opportunity = await repo.findById(id);
  if (!opportunity) throw HttpError.notFound('Opportunity not found');
  if (opportunity.status !== 'pending_approval') {
    throw HttpError.conflict(`Only pending opportunities can be rejected (this one is ${opportunity.status})`);
  }
  await repo.setStatus(id, 'draft');
  return getOne(id, admin);
}
