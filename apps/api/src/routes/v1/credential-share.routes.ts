import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { CredentialShareController } from '../../controllers/credential-share.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validateRequest } from '../../middleware/validation.middleware.js';
import {
  createShareSchema,
  shareIdParamSchema,
  shareTokenParamSchema,
  requestOtpSchema,
  verifyOtpSchema,
} from '../../validators/credential-share.validator.js';

export const credentialShareRouter: Router = Router();

// Memory-backed Multer upload for streaming files securely
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB per individual file
    files: 10,
  },
});

// Rate limiter for public share lookup and OTP actions
const publicShareLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please wait a few minutes before trying again.',
    },
  },
});

// ============================================================================
// Public / External Share Endpoints (Unauthenticated, Token-Protected)
// ============================================================================

// GET /api/v1/credential-shares/public/:token (Fetch share metadata)
credentialShareRouter.get(
  '/public/:token',
  publicShareLimiter,
  validateRequest({ params: shareTokenParamSchema }),
  CredentialShareController.getPublicShareMetadata
);

// POST /api/v1/credential-shares/public/:token/otp/request (Request verification OTP)
credentialShareRouter.post(
  '/public/:token/otp/request',
  publicShareLimiter,
  validateRequest({ params: shareTokenParamSchema, body: requestOtpSchema }),
  CredentialShareController.requestPublicShareOtp
);

// POST /api/v1/credential-shares/public/:token/otp/verify (Verify OTP & grant temporary access)
credentialShareRouter.post(
  '/public/:token/otp/verify',
  publicShareLimiter,
  validateRequest({ params: shareTokenParamSchema, body: verifyOtpSchema }),
  CredentialShareController.verifyPublicShareOtp
);

// GET /api/v1/credential-shares/public/:token/download (Download file with valid share token)
credentialShareRouter.get(
  '/public/:token/download',
  publicShareLimiter,
  validateRequest({ params: shareTokenParamSchema }),
  CredentialShareController.downloadPublicFile
);

// ============================================================================
// Authenticated Employee Endpoints
// ============================================================================
credentialShareRouter.use(authenticate);

// POST /api/v1/credential-shares (Create a new credential or file share)
credentialShareRouter.post(
  '/',
  upload.array('files', 10),
  validateRequest({ body: createShareSchema }),
  CredentialShareController.createShare
);

// GET /api/v1/credential-shares/incoming (List incoming panel shares for current user)
credentialShareRouter.get('/incoming', CredentialShareController.listIncoming);

// GET /api/v1/credential-shares/outgoing (List outgoing panel shares created by current user)
credentialShareRouter.get('/outgoing', CredentialShareController.listOutgoing);

// GET /api/v1/credential-shares/emails (List email shares created by current user)
credentialShareRouter.get('/emails', CredentialShareController.listEmailShares);

// GET /api/v1/credential-shares/recipients (List eligible employee recipients for share dropdown)
credentialShareRouter.get('/recipients', CredentialShareController.listRecipients);

// POST /api/v1/credential-shares/:id/resend-email (Resend email share notification)
credentialShareRouter.post(
  '/:id/resend-email',
  validateRequest({ params: shareIdParamSchema }),
  CredentialShareController.resendEmail
);

// POST /api/v1/credential-shares/:id/approve (Recipient approves share request)
credentialShareRouter.post(
  '/:id/approve',
  validateRequest({ params: shareIdParamSchema }),
  CredentialShareController.approveShare
);

// POST /api/v1/credential-shares/:id/reject (Recipient rejects share request)
credentialShareRouter.post(
  '/:id/reject',
  validateRequest({ params: shareIdParamSchema }),
  CredentialShareController.rejectShare
);

// POST /api/v1/credential-shares/:id/revoke (Owner revokes share)
credentialShareRouter.post(
  '/:id/revoke',
  validateRequest({ params: shareIdParamSchema }),
  CredentialShareController.revokeShare
);

// GET /api/v1/credential-shares/:id/download (Recipient downloads panel shared file)
credentialShareRouter.get(
  '/:id/download',
  validateRequest({ params: shareIdParamSchema }),
  CredentialShareController.downloadPanelSharedFile
);
