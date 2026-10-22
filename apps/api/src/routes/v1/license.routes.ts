import { Router } from 'express';
import { LicenseController } from '../../controllers/license.controller.js';
import { validateRequest } from '../../middleware/validation.middleware.js';
import { importLicenseBodySchema } from '../../validators/license.validator.js';

export const licenseRouter: Router = Router();

// GET /api/v1/license/status - Check active evaluation/production license status
licenseRouter.get('/status', LicenseController.getStatus);

// POST /api/v1/license/import - Validate and import newly signed license file
licenseRouter.post(
  '/import',
  validateRequest({ body: importLicenseBodySchema }),
  LicenseController.importLicense
);

// GET /api/v1/license/machine-id - Return local machine fingerprint
licenseRouter.get('/machine-id', LicenseController.getMachineId);

export default licenseRouter;
