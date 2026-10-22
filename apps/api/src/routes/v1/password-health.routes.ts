import { Router } from 'express';
import { PasswordHealthController } from '../../controllers/password-health.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

export const passwordHealthRouter = Router();

/**
 * @route   GET /api/v1/password-health
 * @desc    Get overall password health summary for authenticated user
 * @access  Private (Authenticated)
 */
passwordHealthRouter.get('/', authenticate, PasswordHealthController.getSummary);

/**
 * @route   GET /api/v1/password-health/credentials
 * @desc    Get full credential-level password health analysis
 * @access  Private (Authenticated)
 */
passwordHealthRouter.get('/credentials', authenticate, PasswordHealthController.getCredentialHealthList);

/**
 * @route   GET /api/v1/password-health/credentials/:id
 * @desc    Get password health analysis for a single credential
 * @access  Private (Authenticated)
 */
passwordHealthRouter.get('/credentials/:id', authenticate, PasswordHealthController.getSingleCredentialHealth);

