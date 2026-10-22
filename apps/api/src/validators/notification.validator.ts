import { z } from 'zod';
import { NOTIFICATION_CONFIG } from '@credential-manager/config';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const notificationIdParamSchema = z.object({
  id: z
    .string({ required_error: 'Notification ID is required' })
    .regex(objectIdRegex, 'Invalid notification identifier format'),
});

export const notificationQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : NOTIFICATION_CONFIG.defaultPage))
    .refine((val) => !isNaN(val) && val > 0, {
      message: 'Page must be a positive integer',
    }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : NOTIFICATION_CONFIG.defaultLimit))
    .refine((val) => !isNaN(val) && val > 0 && val <= NOTIFICATION_CONFIG.maxLimit, {
      message: `Limit must be a positive integer between 1 and ${NOTIFICATION_CONFIG.maxLimit}`,
    }),
});
