import { Router } from 'express';
import { AuditLogController } from '../../controllers/audit-log.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { validateRequest } from '../../middleware/validation.middleware.js';
import {
  auditLogQuerySchema,
  auditLogIdParamSchema,
} from '../../validators/audit-log.validator.js';

export const auditLogRouter: Router = Router();

// All audit routes strictly require authentication and ADMIN role
auditLogRouter.use(authenticate);
auditLogRouter.use(requireRole('ADMIN'));

/**
 * GET /api/v1/audit-logs
 * List paginated and filtered audit logs (Admin only)
 */
auditLogRouter.get(
  '/',
  validateRequest({ query: auditLogQuerySchema }),
  AuditLogController.listAuditLogs
);

/**
 * GET /api/v1/audit-logs/:id
 * Retrieve specific audit log entry by ID (Admin only)
 */
auditLogRouter.get(
  '/:id',
  validateRequest({ params: auditLogIdParamSchema }),
  AuditLogController.getAuditLogById
);
