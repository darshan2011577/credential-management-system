import { z } from 'zod';

export const importLicenseBodySchema = z.object({
  licenseContent: z
    .string({ required_error: 'licenseContent is required' })
    .min(10, 'License content is too short to be a valid signed license'),
});

export type ImportLicenseInput = z.infer<typeof importLicenseBodySchema>;
