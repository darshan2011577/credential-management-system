import { Router } from 'express';
import v1Router from './v1.routes.js';
import healthRouter from './health.routes.js';

const apiRouter: Router = Router();

// Primary Versioned API Routes (/api/v1/*)
apiRouter.use('/v1', v1Router);

// Compatibility Alias (/api/health -> /api/v1/health)
apiRouter.use('/health', healthRouter);

export default apiRouter;
