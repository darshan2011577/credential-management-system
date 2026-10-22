import { Request, Response, NextFunction } from 'express';
import { createSuccessResponse } from '@credential-manager/shared';
import { HealthService } from '../services/health.service.js';

export class HealthController {
  static async getHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const healthData = await HealthService.getHealthStatus();
      res.status(200).json(
        createSuccessResponse(healthData, 'Local API is operational', req.id)
      );
    } catch (error) {
      next(error);
    }
  }
}
