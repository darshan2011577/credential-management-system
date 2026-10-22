import { Router } from 'express';
import { CredentialController } from '../../controllers/credential.controller.js';
import { CredentialShareController } from '../../controllers/credential-share.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validateRequest } from '../../middleware/validation.middleware.js';
import { revealRateLimiter } from '../../middleware/reveal-limiter.middleware.js';
import {
  createCredentialSchema,
  updateCredentialSchema,
  listCredentialsQuerySchema,
  generatePasswordSchema,
} from '../../validators/credential.validator.js';

const credentialRouter: Router = Router();

// All credential routes strictly require authentication
credentialRouter.use(authenticate);

// Cryptographic password generator
credentialRouter.post(
  '/generate-password',
  validateRequest({ body: generatePasswordSchema }),
  CredentialController.generatePassword
);

// Phase 8 & 14: Shared credentials & files accessible to current user (Must precede /:id)
credentialRouter.get(
  '/shared',
  CredentialShareController.listSharedCredentials
);

credentialRouter.get(
  '/shared/files',
  CredentialShareController.listSharedFiles
);

credentialRouter.get(
  '/shared/:id',
  CredentialShareController.getSharedCredential
);

credentialRouter.post(
  '/shared/:id/reveal',
  revealRateLimiter,
  CredentialShareController.revealSharedPassword
);

// Credential CRUD endpoints
credentialRouter.post(
  '/',
  validateRequest({ body: createCredentialSchema }),
  CredentialController.create
);

credentialRouter.get(
  '/',
  validateRequest({ query: listCredentialsQuerySchema }),
  CredentialController.list
);

credentialRouter.get(
  '/:id',
  CredentialController.getById
);

credentialRouter.patch(
  '/:id',
  validateRequest({ body: updateCredentialSchema }),
  CredentialController.update
);

credentialRouter.delete(
  '/:id',
  CredentialController.delete
);

// Explicit password reveal with dedicated rate limiting
credentialRouter.post(
  '/:id/reveal',
  revealRateLimiter,
  CredentialController.reveal
);

export default credentialRouter;

