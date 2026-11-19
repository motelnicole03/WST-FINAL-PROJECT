import { z } from 'zod';

const email = z.string().trim().toLowerCase().email();
// bcrypt only uses the first 72 bytes, so longer passwords add nothing
const password = z.string().min(8, 'Password must be at least 8 characters').max(72);

const studentRegistration = z.object({
  role: z.literal('student'),
  email,
  password,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  studentNumber: z.string().trim().min(1).max(50),
  programId: z.number().int().positive(),
  yearLevel: z.number().int().min(1).max(10),
});

const employerRegistration = z.object({
  role: z.literal('employer'),
  email,
  password,
  companyName: z.string().trim().min(1).max(200),
  industry: z.string().trim().max(100).optional(),
  address: z.string().trim().max(500).optional(),
  contactPerson: z.string().trim().max(150).optional(),
});

// Only students and employers can self-register.
// Admin and coordinator accounts are created by the seed script or by an admin.
export const registerSchema = z.discriminatedUnion('role', [studentRegistration, employerRegistration]);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
