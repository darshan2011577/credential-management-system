import { Router } from 'express';
import { AuthController } from '../../controllers/auth.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { authRateLimiter } from '../../middleware/auth-limiter.middleware.js';
import { validateRequest } from '../../middleware/validation.middleware.js';
import { loginBodySchema, changePasswordBodySchema, registerBodySchema } from '../../validators/auth.validator.js';

const authRouter: Router = Router();

// POST /api/v1/auth/register (Public, Rate limited, Zod validated)
authRouter.post(
  '/register',
  authRateLimiter,
  validateRequest({ body: registerBodySchema }),
  AuthController.register
);

// POST /api/v1/auth/login (Rate limited, Zod validated)
authRouter.post(
  '/login',
  authRateLimiter,
  validateRequest({ body: loginBodySchema }),
  AuthController.login
);

// POST /api/v1/auth/refresh
authRouter.post(
  '/refresh',
  AuthController.refresh
);

// POST /api/v1/auth/logout
authRouter.post(
  '/logout',
  AuthController.logout
);

// GET /api/v1/auth/me (Protected)
authRouter.get(
  '/me',
  authenticate,
  AuthController.getMe
);

// POST /api/v1/auth/change-password (Protected, Rate limited, Zod validated)
authRouter.post(
  '/change-password',
  authRateLimiter,
  authenticate,
  validateRequest({ body: changePasswordBodySchema }),
  AuthController.changePassword
);

export default authRouter;

