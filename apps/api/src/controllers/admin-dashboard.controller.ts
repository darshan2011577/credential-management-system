import { Request, Response, NextFunction } from 'express';
import { createSuccessResponse } from '@credential-manager/shared';
import { AdminDashboardQuery } from '@credential-manager/types';
import { AdminDashboardService } from '../services/admin-dashboard.service.js';
import { AppError } from '../utils/errors.js';

export class AdminDashboardController {
  /**
   * GET /api/v1/admin/dashboard
   * Retrieves comprehensive aggregated platform statistics for Admin overview.
   */
  public static async getDashboardStats(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        throw AppError.forbidden('Access denied. Administrator privileges required.');
      }

      const query = req.query as unknown as AdminDashboardQuery;
      const data = await AdminDashboardService.getDashboardStats(query);

      res.status(200).json(
        createSuccessResponse(
          data,
          'Admin dashboard statistics retrieved successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/dashboard/employees
   * Retrieves employee overview with password health and credential aggregates.
   */
  public static async getEmployeeOverview(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        throw AppError.forbidden('Access denied. Administrator privileges required.');
      }

      const query = req.query as unknown as AdminDashboardQuery;
      const data = await AdminDashboardService.getDashboardStats(query);

      res.status(200).json(
        createSuccessResponse(
          { employees: data.employeeOverview },
          'Employee overview retrieved successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/dashboard/activity
   * Retrieves sanitized recent platform security activity feed.
   */
  public static async getActivityFeed(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        throw AppError.forbidden('Access denied. Administrator privileges required.');
      }

      const query = req.query as unknown as AdminDashboardQuery;
      const data = await AdminDashboardService.getDashboardStats(query);

      res.status(200).json(
        createSuccessResponse(
          { recentActivity: data.recentActivity },
          'Recent platform activity retrieved successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }
}
