import { z } from 'zod';
import { CREDENTIAL_CONFIG } from '@credential-manager/config';

export const createCredentialSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .trim()
    .min(1, 'Title cannot be empty')
    .max(CREDENTIAL_CONFIG.maxTitleLength, `Title cannot exceed ${CREDENTIAL_CONFIG.maxTitleLength} characters`),
  website: z
    .string()
    .trim()
    .max(CREDENTIAL_CONFIG.maxWebsiteLength, `Website URL cannot exceed ${CREDENTIAL_CONFIG.maxWebsiteLength} characters`)
    .optional()
    .default(''),
  username: z
    .string({ required_error: 'Username / Account ID is required' })
    .trim()
    .min(1, 'Username cannot be empty')
    .max(CREDENTIAL_CONFIG.maxUsernameLength, `Username cannot exceed ${CREDENTIAL_CONFIG.maxUsernameLength} characters`),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password cannot be empty')
    .max(500, 'Password is too long'),
  category: z
    .enum(CREDENTIAL_CONFIG.categories, {
      errorMap: () => ({ message: 'Please select a valid category' }),
    })
    .default('OTHER'),
  notes: z
    .string()
    .trim()
    .max(CREDENTIAL_CONFIG.maxNotesLength, `Notes cannot exceed ${CREDENTIAL_CONFIG.maxNotesLength} characters`)
    .optional()
    .default(''),
  favorite: z.boolean().optional().default(false),
});

export const updateCredentialSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title cannot be empty')
    .max(CREDENTIAL_CONFIG.maxTitleLength, `Title cannot exceed ${CREDENTIAL_CONFIG.maxTitleLength} characters`)
    .optional(),
  website: z
    .string()
    .trim()
    .max(CREDENTIAL_CONFIG.maxWebsiteLength, `Website URL cannot exceed ${CREDENTIAL_CONFIG.maxWebsiteLength} characters`)
    .optional(),
  username: z
    .string()
    .trim()
    .min(1, 'Username cannot be empty')
    .max(CREDENTIAL_CONFIG.maxUsernameLength, `Username cannot exceed ${CREDENTIAL_CONFIG.maxUsernameLength} characters`)
    .optional(),
  password: z
    .string()
    .min(1, 'Password cannot be empty')
    .max(500, 'Password is too long')
    .optional(),
  category: z
    .enum(CREDENTIAL_CONFIG.categories, {
      errorMap: () => ({ message: 'Please select a valid category' }),
    })
    .optional(),
  notes: z
    .string()
    .trim()
    .max(CREDENTIAL_CONFIG.maxNotesLength, `Notes cannot exceed ${CREDENTIAL_CONFIG.maxNotesLength} characters`)
    .optional(),
  favorite: z.boolean().optional(),
});

export const listCredentialsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : CREDENTIAL_CONFIG.defaultPage)),
  limit: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return CREDENTIAL_CONFIG.defaultPageLimit;
      const parsed = parseInt(val, 10) || CREDENTIAL_CONFIG.defaultPageLimit;
      return Math.min(Math.max(1, parsed), CREDENTIAL_CONFIG.maxPageLimit);
    }),
  search: z.string().trim().optional(),
  category: z.enum(CREDENTIAL_CONFIG.categories).optional(),
  favorite: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((val) => (val === true || val === 'true' ? true : val === false || val === 'false' ? false : undefined)),
});

export const generatePasswordSchema = z.object({
  length: z
    .number()
    .int()
    .min(CREDENTIAL_CONFIG.passwordGenerator.minLength, `Minimum length is ${CREDENTIAL_CONFIG.passwordGenerator.minLength}`)
    .max(CREDENTIAL_CONFIG.passwordGenerator.maxLength, `Maximum length is ${CREDENTIAL_CONFIG.passwordGenerator.maxLength}`)
    .optional()
    .default(CREDENTIAL_CONFIG.passwordGenerator.defaultLength),
  uppercase: z.boolean().optional().default(true),
  lowercase: z.boolean().optional().default(true),
  numbers: z.boolean().optional().default(true),
  symbols: z.boolean().optional().default(true),
});
