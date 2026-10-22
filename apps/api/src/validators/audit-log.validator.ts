import { z } from 'zod';
import { AUDIT_CONFIG } from '@credential-manager/config';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const auditLogIdParamSchema = z.object({
  id: z
    .string({ required_error: 'Audit log ID is required' })
    .regex(objectIdRegex, 'Invalid audit log identifier format'),
});

export const auditLogQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : AUDIT_CONFIG.defaultPage))
    .refine((val) => !isNaN(val) && val > 0, {
      message: 'Page must be a positive integer',
    }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : AUDIT_CONFIG.defaultLimit))
    .refine((val) => !isNaN(val) && val > 0 && val <= AUDIT_CONFIG.maxLimit, {
      message: `Limit must be a positive integer between 1 and ${AUDIT_CONFIG.maxLimit}`,
    }),
  category: z
    .enum(AUDIT_CONFIG.categories as any)
    .optional(),
  action: z
    .string()
    .trim()
    .optional(),
  result: z
    .enum(AUDIT_CONFIG.results as any)
    .optional(),
  actorId: z
    .string()
    .regex(objectIdRegex, 'Invalid actor ID format')
    .optional(),
  targetUserId: z
    .string()
    .regex(objectIdRegex, 'Invalid target user ID format')
    .optional(),
  resourceType: z
    .string()
    .trim()
    .optional(),
  resourceId: z
    .string()
    .trim()
    .optional(),
  from: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid from date format',
    }),
  to: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid to date format',
    }),
  search: z
    .string()
    .trim()
    .max(100, 'Search keyword cannot exceed 100 characters')
    .optional(),
});
