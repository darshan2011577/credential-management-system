import { Request, Response, NextFunction } from 'express';
import { createSuccessResponse } from '@credential-manager/shared';
import { LicenseService } from '../services/license.service.js';

export class LicenseController {
  /**
   * GET /api/v1/license/status
   * Inspect current evaluation / production license validation status.
   */
  public static async getStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const forceRecheck = req.query.refresh === 'true';
      const status = await LicenseService.validateLicense(undefined, forceRecheck);

      res.status(200).json(
        createSuccessResponse(
          status,
          'License status retrieved successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/license/import
   * Atomically validate and import a new signed license file.
   */
  public static async importLicense(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { licenseContent } = req.body;
      const result = await LicenseService.importLicense(licenseContent, req.user);

      res.status(200).json(
        createSuccessResponse(
          result,
          result.message,
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/license/machine-id
   * Returns current machine fingerprint for license locking/generation.
   */
  public static async getMachineId(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const machineId = LicenseService.getMachineFingerprint();

      res.status(200).json(
        createSuccessResponse(
          { machineId },
          'Machine identifier retrieved successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }
}
