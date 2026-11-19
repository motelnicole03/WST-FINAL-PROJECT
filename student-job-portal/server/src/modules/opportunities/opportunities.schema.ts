import { z } from 'zod';

export const OPPORTUNITY_TYPES = ['job', 'internship', 'ojt'] as const;
export const WORK_SETUPS = ['onsite', 'remote', 'hybrid'] as const;
export const SORTS = ['newest', 'deadline'] as const;

export type OpportunityStatus = 'draft' | 'pending_approval' | 'open' | 'closed' | 'filled';

const fields = z.object({
  type: z.enum(OPPORTUNITY_TYPES),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(10000).optional(),
  requirements: z.string().trim().max(10000).optional(),
  location: z.string().trim().max(200).optional(),
  workSetup: z.enum(WORK_SETUPS).optional(),
  allowanceSalary: z.number().min(0).max(9999999999).optional(),
  slots: z.number().int().min(1).max(10000).optional(),
  deadline: z.string().datetime({ offset: true }).optional(),
  // Leave out to make the opportunity open to every program
  programId: z.number().int().positive().optional(),
  skillIds: z.array(z.number().int().positive()).max(20).optional(),
});

export const createOpportunitySchema = fields;

export const updateOpportunitySchema = fields
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');

// Query-string values arrive as text, so numbers are coerced.
export const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.enum(OPPORTUNITY_TYPES).optional(),
  workSetup: z.enum(WORK_SETUPS).optional(),
  location: z.string().trim().max(100).optional(),
  programId: z.coerce.number().int().positive().optional(),
  skillId: z.coerce.number().int().positive().optional(),
  sort: z.enum(SORTS).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;
export type UpdateOpportunityInput = z.infer<typeof updateOpportunitySchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
