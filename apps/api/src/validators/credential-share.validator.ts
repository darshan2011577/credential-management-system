import { z } from 'zod';
import { SHARE_CONFIG } from '@credential-manager/config';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createShareSchema = z
  .object({
    resourceType: z.enum(SHARE_CONFIG.resourceTypes).default('CREDENTIAL'),
    shareMethod: z.enum(SHARE_CONFIG.shareMethods).default('PANEL'),
    credentialId: z.string().regex(objectIdRegex, 'Invalid credential identifier format').optional(),
    linkedCredentialId: z.string().regex(objectIdRegex, 'Invalid linked credential identifier format').optional(),
    recipientId: z.string().regex(objectIdRegex, 'Invalid recipient identifier format').optional(),
    recipientEmail: z.string().email('Invalid email address format').optional(),
    permission: z.string().default('VIEW'),
    compress: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
    maxDownloads: z.preprocess((val) => (val ? Number(val) : undefined), z.number().int().positive().optional()),
    expiresAt: z
      .string({ required_error: 'Expiration timestamp is required' })
      .refine((val) => !isNaN(Date.parse(val)), {
        message: 'Invalid expiration timestamp format',
      })
      .refine(
        (val) => {
          const exp = new Date(val).getTime();
          const minTime = Date.now() + (SHARE_CONFIG.minExpirationMinutes || 5) * 60 * 1000;
          return exp > minTime;
        },
        {
          message: `Expiration must be at least ${SHARE_CONFIG.minExpirationMinutes || 5} minutes in the future`,
        }
      )
      .refine(
        (val) => {
          const exp = new Date(val).getTime();
          const maxTime = Date.now() + (SHARE_CONFIG.maxExpirationDays || 90) * 24 * 60 * 60 * 1000;
          return exp <= maxTime;
        },
        {
          message: `Expiration cannot exceed ${SHARE_CONFIG.maxExpirationDays || 90} days in the future`,
        }
      ),
  })
  .refine(
    (data) => {
      if (data.resourceType === 'CREDENTIAL' && !data.credentialId) {
        return false;
      }
      return true;
    },
    {
      message: 'Credential ID is required when sharing a credential',
      path: ['credentialId'],
    }
  )
  .refine(
    (data) => {
      if (data.shareMethod === 'PANEL' && !data.recipientId) {
        return false;
      }
      return true;
    },
    {
      message: 'Recipient employee is required for Panel Share',
      path: ['recipientId'],
    }
  )
  .refine(
    (data) => {
      if (data.shareMethod === 'EMAIL' && !data.recipientEmail) {
        return false;
      }
      return true;
    },
    {
      message: 'Recipient email is required for Email Share',
      path: ['recipientEmail'],
    }
  );

export const shareIdParamSchema = z.object({
  id: z
    .string({ required_error: 'Share ID is required' })
    .regex(objectIdRegex, 'Invalid share identifier format'),
});

export const sharedCredentialIdParamSchema = z.object({
  id: z
    .string({ required_error: 'Credential ID is required' })
    .regex(objectIdRegex, 'Invalid credential identifier format'),
});

export const shareTokenParamSchema = z.object({
  token: z.string({ required_error: 'Share token is required' }).min(16, 'Invalid share token format'),
});

export const requestOtpSchema = z.object({
  email: z.string({ required_error: 'Email is required' }).email('Invalid email address format'),
});

export const verifyOtpSchema = z.object({
  email: z.string({ required_error: 'Email is required' }).email('Invalid email address format'),
  otp: z.string({ required_error: 'Verification code is required' }).length(6, 'Verification code must be 6 digits'),
});
