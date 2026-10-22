import { Router } from 'express';
import { AdminRegistrationController } from '../../controllers/admin-registration.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { validateRequest } from '../../middleware/validation.middleware.js';
import {
  listRegistrationsQuerySchema,
  registrationIdParamSchema,
  rejectRegistrationBodySchema,
} from '../../validators/registration.validator.js';

export const adminRegistrationRouter: Router = Router();

// Server-side strict authorization: Admin role and authentication required for all routes
adminRegistrationRouter.use(authenticate);
adminRegistrationRouter.use(requireRole('ADMIN'));

/**
 * GET /api/v1/admin/registrations
 * List employee registrations with optional status and department filters
 */
adminRegistrationRouter.get(
  '/',
  validateRequest({ query: listRegistrationsQuerySchema }),
  AdminRegistrationController.listRegistrations
);

/**
 * GET /api/v1/admin/registrations/:id
 * View full registration details
 */
adminRegistrationRouter.get(
  '/:id',
  validateRequest({ params: registrationIdParamSchema }),
  AdminRegistrationController.getRegistrationDetails
);

/**
 * POST /api/v1/admin/registrations/:id/approve
 * Approve employee registration and generate initial secure password representation
 */
adminRegistrationRouter.post(
  '/:id/approve',
  validateRequest({ params: registrationIdParamSchema }),
  AdminRegistrationController.approveRegistration
);

/**
 * POST /api/v1/admin/registrations/:id/send-credentials
 * Generate temporary password and dispatch login credentials email
 */
adminRegistrationRouter.post(
  '/:id/send-credentials',
  validateRequest({ params: registrationIdParamSchema }),
  AdminRegistrationController.sendCredentials
);

/**
 * POST /api/v1/admin/registrations/:id/resend-credentials
 * Resend fresh login credentials email
 */
adminRegistrationRouter.post(
  '/:id/resend-credentials',
  validateRequest({ params: registrationIdParamSchema }),
  AdminRegistrationController.resendCredentials
);

/**
 * POST /api/v1/admin/registrations/:id/reject
 * Reject pending employee registration
 */
adminRegistrationRouter.post(
  '/:id/reject',
  validateRequest({
    params: registrationIdParamSchema,
    body: rejectRegistrationBodySchema,
  }),
  AdminRegistrationController.rejectRegistration
);

/**
 * POST /api/v1/admin/registrations/:id/suspend
 * Suspend an employee account
 */
adminRegistrationRouter.post(
  '/:id/suspend',
  validateRequest({ params: registrationIdParamSchema }),
  AdminRegistrationController.suspendUser
);

/**
 * POST /api/v1/admin/registrations/:id/reactivate
 * Reactivate a suspended employee account
 */
adminRegistrationRouter.post(
  '/:id/reactivate',
  validateRequest({ params: registrationIdParamSchema }),
  AdminRegistrationController.reactivateUser
);

/**
 * DELETE /api/v1/admin/registrations/:id
 * Permanently delete employee account and records
 */
adminRegistrationRouter.delete(
  '/:id',
  validateRequest({ params: registrationIdParamSchema }),
  AdminRegistrationController.deleteUser
);

export default adminRegistrationRouter;

