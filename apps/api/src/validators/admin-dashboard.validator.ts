import { z } from 'zod';

export const adminDashboardQuerySchema = z.object({
  dateRange: z
    .enum(['TODAY', 'LAST_7_DAYS', 'LAST_30_DAYS', 'THIS_MONTH', 'ALL_TIME'])
    .optional()
    .default('LAST_30_DAYS'),
  employeeId: z.string().optional(),
  from: z.string().datetime({ message: 'from must be a valid ISO 8601 date string' }).optional(),
  to: z.string().datetime({ message: 'to must be a valid ISO 8601 date string' }).optional(),
});

export type AdminDashboardQueryInput = z.infer<typeof adminDashboardQuerySchema>;
