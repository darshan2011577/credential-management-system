import { z } from 'zod';

export const registrationIdParamSchema = z.object({
  id: z
    .string({ required_error: 'Registration ID is required' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid registration identifier format'),
});

export const rejectRegistrationBodySchema = z.object({
  reason: z
    .string()
    .trim()
    .max(250, 'Rejection reason cannot exceed 250 characters')
    .optional()
    .or(z.literal('')),
});

export const listRegistrationsQuerySchema = z.object({
  status: z
    .enum(['PENDING', 'APPROVED', 'ACTIVE', 'REJECTED', 'DISABLED', 'INACTIVE', 'SUSPENDED'])
    .optional(),
  department: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
