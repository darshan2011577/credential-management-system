import { Router } from 'express';
import { AdminDashboardController } from '../../controllers/admin-dashboard.controller.js';
import { AdminRegistrationController } from '../../controllers/admin-registration.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { validateRequest } from '../../middleware/validation.middleware.js';
import { adminDashboardQuerySchema } from '../../validators/admin-dashboard.validator.js';
import { registrationIdParamSchema } from '../../validators/registration.validator.js';

export const adminDashboardRouter: Router = Router();

// Strict Security Barrier: All admin dashboard endpoints require authentication and ADMIN role
adminDashboardRouter.use(authenticate);
adminDashboardRouter.use(requireRole('ADMIN'));

/**
 * GET /api/v1/admin/dashboard
 * Aggregated statistics and metadata for Admin Dashboard
 */
adminDashboardRouter.get(
  '/dashboard',
  validateRequest({ query: adminDashboardQuerySchema }),
  AdminDashboardController.getDashboardStats
);

/**
 * GET /api/v1/admin/dashboard/employees
 * Employee health & credential summary list
 */
adminDashboardRouter.get(
  '/dashboard/employees',
  validateRequest({ query: adminDashboardQuerySchema }),
  AdminDashboardController.getEmployeeOverview
);

/**
 * POST /api/v1/admin/employees/:id/suspend
 * Suspend employee account
 */
adminDashboardRouter.post(
  '/employees/:id/suspend',
  validateRequest({ params: registrationIdParamSchema }),
  AdminRegistrationController.suspendUser
);

/**
 * POST /api/v1/admin/employees/:id/reactivate
 * Reactivate suspended employee account
 */
adminDashboardRouter.post(
  '/employees/:id/reactivate',
  validateRequest({ params: registrationIdParamSchema }),
  AdminRegistrationController.reactivateUser
);

/**
 * DELETE /api/v1/admin/employees/:id
 * Delete employee account permanently
 */
adminDashboardRouter.delete(
  '/employees/:id',
  validateRequest({ params: registrationIdParamSchema }),
  AdminRegistrationController.deleteUser
);

/**
 * GET /api/v1/admin/dashboard/activity
 * Recent sanitized platform activity feed
 */
adminDashboardRouter.get(
  '/dashboard/activity',
  validateRequest({ query: adminDashboardQuerySchema }),
  AdminDashboardController.getActivityFeed
);

export default adminDashboardRouter;

