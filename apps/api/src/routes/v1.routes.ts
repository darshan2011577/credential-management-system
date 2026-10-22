import { Router } from 'express';
import healthRouter from './health.routes.js';
import authRouter from './v1/auth.routes.js';
import credentialRouter from './v1/credential.routes.js';
import { passwordHealthRouter } from './v1/password-health.routes.js';
import { credentialShareRouter } from './v1/credential-share.routes.js';
import { notificationRouter } from './v1/notification.routes.js';
import { auditLogRouter } from './v1/audit-log.routes.js';
import { licenseRouter } from './v1/license.routes.js';
import { adminDashboardRouter } from './v1/admin-dashboard.routes.js';
import { adminRegistrationRouter } from './v1/admin-registration.routes.js';
import { adminPasswordRequestRouter, authPasswordRequestRouter } from './v1/password-request.routes.js';
import { licenseMiddleware } from '../middleware/license.middleware.js';

const v1Router: Router = Router();

// License Enforcement Middleware (protects all business routes except health & license endpoints)
v1Router.use(licenseMiddleware);

// Health Check Module
v1Router.use('/health', healthRouter);

// Phase 11: 2-Month License Management & Expiry System
v1Router.use('/license', licenseRouter);

// Phase 12 & 13: Admin Security Dashboard, Employee Registrations & Password Requests (Admin Only)
v1Router.use('/admin', adminDashboardRouter);
v1Router.use('/admin/registrations', adminRegistrationRouter);
v1Router.use('/admin/password-requests', adminPasswordRequestRouter);

// Password Request User Endpoints (/api/v1/auth/password-requests/*)
v1Router.use('/auth/password-requests', authPasswordRequestRouter);

// Phase 5: Authentication & User Management
v1Router.use('/auth', authRouter);

// Phase 6: Credential Management & AES-256-GCM Encryption
v1Router.use('/credentials', credentialRouter);

// Phase 7: Password Health Analysis
v1Router.use('/password-health', passwordHealthRouter);

// Phase 8: Secure Credential Sharing
v1Router.use('/credential-shares', credentialShareRouter);

// Phase 9: In-App Notifications & Email Events
v1Router.use('/notifications', notificationRouter);

// Phase 10: Security Audit Logging (Admin Only)
v1Router.use('/audit-logs', auditLogRouter);

export default v1Router;





