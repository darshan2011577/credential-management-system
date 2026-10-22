import { Router } from 'express';
import { PasswordRequestController } from '../../controllers/password-request.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { authRateLimiter } from '../../middleware/auth-limiter.middleware.js';

// Router for user auth-related password requests
export const authPasswordRequestRouter: Router = Router();

// Public: Forgot Password submission from Login page
authPasswordRequestRouter.post(
  '/forgot',
  authRateLimiter,
  PasswordRequestController.submitForgotPassword
);

// Protected: Submit password change request from Account Settings
authPasswordRequestRouter.post(
  '/change',
  authRateLimiter,
  authenticate,
  PasswordRequestController.submitChangeRequest
);

// Protected: Get current user's pending request status
authPasswordRequestRouter.get(
  '/my-pending',
  authenticate,
  PasswordRequestController.getMyPendingRequest
);

// Router for Administrator password request management
export const adminPasswordRequestRouter: Router = Router();

adminPasswordRequestRouter.use(authenticate);
adminPasswordRequestRouter.use(requireRole('ADMIN'));

// GET /api/v1/admin/password-requests
adminPasswordRequestRouter.get(
  '/',
  PasswordRequestController.listRequests
);

// POST /api/v1/admin/password-requests/:id/approve
adminPasswordRequestRouter.post(
  '/:id/approve',
  PasswordRequestController.approveRequest
);

// POST /api/v1/admin/password-requests/:id/reject
adminPasswordRequestRouter.post(
  '/:id/reject',
  PasswordRequestController.rejectRequest
);
