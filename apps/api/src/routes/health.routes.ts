import { Router } from 'express';
import { HealthController } from '../controllers/health.controller.js';

const healthRouter: Router = Router();

// GET /api/v1/health or /api/health
healthRouter.get('/', HealthController.getHealth);

export default healthRouter;
