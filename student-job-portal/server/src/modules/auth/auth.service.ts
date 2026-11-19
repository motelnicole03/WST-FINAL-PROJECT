import { withTransaction } from '../../config/db';
import { HttpError } from '../../utils/httpError';
import { signToken } from '../../utils/jwt';
import { hashPassword, verifyPassword } from '../../utils/password';
import { LoginInput, RegisterInput } from './auth.schema';
import * as repo from './auth.repository';

export async function register(input: RegisterInput) {
  if (await repo.findUserByEmail(input.email)) {
    throw HttpError.conflict('Email is already registered');
  }

  const passwordHash = await hashPassword(input.password);

  const user = await withTransaction(async (client) => {
    const created = await repo.insertUser(client, input.email, passwordHash, input.role, 'active');
    if (input.role === 'student') {
      await repo.insertStudent(client, created.user_id, input);
    } else {
      // Employers start with verification_status = 'pending' until an admin verifies them.
      await repo.insertEmployer(client, created.user_id, input);
    }
    return created;
  });

  return {
    token: signToken({ userId: user.user_id, role: user.role }),
    user: { id: user.user_id, email: user.email, role: user.role },
  };
}

export async function login({ email, password }: LoginInput) {
  const user = await repo.findUserByEmail(email);

  // Same message for "no such user" and "wrong password" so emails cannot be probed.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw HttpError.unauthorized('Invalid email or password');
  }
  if (user.status === 'suspended' || user.status === 'inactive') {
    throw HttpError.forbidden('This account is not active');
  }

  return {
    token: signToken({ userId: user.user_id, role: user.role }),
    user: { id: user.user_id, email: user.email, role: user.role },
  };
}

export async function getCurrentUser(userId: number) {
  const row = await repo.findUserProfile(userId);
  if (!row) throw HttpError.notFound('User not found');

  return {
    id: row.user_id,
    email: row.email,
    role: row.role,
    status: row.status,
    student: row.student_id
      ? { id: row.student_id, firstName: row.first_name, lastName: row.last_name }
      : null,
    employer: row.employer_id
      ? { id: row.employer_id, companyName: row.company_name, verificationStatus: row.verification_status }
      : null,
  };
}
